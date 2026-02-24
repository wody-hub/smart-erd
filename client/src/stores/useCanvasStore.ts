import * as Y from 'yjs';
import { create } from 'zustand';
import {
  type Edge,
  type Node,
  type NodeChange,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { Column, GroupNodeData, RelationType, TableNodeData } from '@/types/erd';
import type { DdlParseResult } from '@/lib/ddl-parser';
import { djb2 } from '@/lib/hash';
import { extractColId } from '@/lib/handle-id';
import {
  yTablesMapToNodes,
  yEdgesMapToEdges,
  yGroupsMapToNodes,
  yDocToJson,
  createColumnYMap,
  createEdgeYMap,
  createTableYMap,
  createGroupYMap,
  deleteColumnFromYArray,
  moveColumnInYArray,
  getTablesMap,
  getEdgesMap,
  getGroupsMap,
} from '@/collaboration/yjsBridge';

/** 드래그 중인 position 대기 큐 컨텍스트 */
interface PositionQueueCtx {
  pending: Map<string, { x: number; y: number }>;
}

/**
 * 렌더링과 무관한 스토어 내부 상태.
 *
 * 이 객체의 필드들은 Zustand `set()`을 거치지 않고 직접 변이(mutate)한다.
 * 이는 의도적인 설계로, React 리렌더링을 트리거하지 않아야 하는 상태
 * (드래그 중 플래그, Observer 참조, 위치 대기 큐 등)를 Zustand 구독 범위 밖에서 관리한다.
 * Zustand DevTools에는 추적되지 않으므로 디버깅 시 유의한다.
 */
interface InternalState {
  tablesObserver: ((events: Y.YEvent<Y.AbstractType<unknown>>[]) => void) | null;
  edgesObserver: (() => void) | null;
  groupsObserver: (() => void) | null;
  isNodeDragging: boolean;
  hasDeferredTableSync: boolean;
  groupNodeIds: Set<string>;
  tablePositionQueue: PositionQueueCtx;
  groupPositionQueue: PositionQueueCtx;
}

/**
 * ERD 캔버스 상태를 관리하는 Zustand 스토어의 상태 인터페이스.
 */
interface CanvasState {
  nodes: Node<TableNodeData>[];
  groupNodes: Node<GroupNodeData>[];
  edges: Edge[];
  highlightedNodeIds: string[];
  highlightedEdgeId: string | null;
  /** 현재 편집 모드로 활성화된 노드 ID (null이면 모든 노드가 정적 뷰) */
  activeEditNodeId: string | null;
  /** 편집 모드 노드를 설정한다. */
  setActiveEditNodeId: (id: string | null) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: (nodes: Node<TableNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  lastBackupHash: string;
  markBackedUp: (hash: string) => void;
  prepareBackup: () => { content: string; hash: string } | null;
  addTable: (name?: string) => void;
  deleteTable: (nodeId: string) => void;
  renameTable: (nodeId: string, newName: string) => void;
  updateTableMeta: (
    nodeId: string,
    updates: Partial<
      Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId' | 'headerColor'>
    >,
  ) => void;
  addColumn: (nodeId: string) => void;
  deleteColumn: (nodeId: string, colId: string) => void;
  updateColumn: (nodeId: string, colId: string, updates: Partial<Column>) => void;
  moveColumn: (nodeId: string, fromIndex: number, toIndex: number) => void;
  setHighlightedNodes: (ids: string[]) => void;
  setHighlightedEdge: (id: string | null) => void;
  clearHighlights: () => void;
  removeEdge: (edgeId: string) => void;
  removeEdgeWithFkColumn: (edgeId: string) => void;
  applyLayout: (nodes: Node<TableNodeData>[]) => void;
  serialize: () => string;
  addFkRelation: (
    parentNodeId: string,
    childNodeId: string,
    pkColumns: Column[],
    parentLabel: string,
    existingNames: string[],
    relationType: RelationType,
  ) => number;
  connectWithRelationType: (
    source: string,
    target: string,
    sourceHandle: string | undefined,
    targetHandle: string | undefined,
    relationType: RelationType,
  ) => void;
  importDdl: (result: DdlParseResult) => void;
  replaceFromDdl: (result: DdlParseResult) => void;
  addGroup: (label?: string) => void;
  deleteGroup: (groupId: string) => void;
  renameGroup: (groupId: string, newName: string) => void;
  resizeGroup: (groupId: string, width: number, height: number) => void;
  updateGroupMeta: (groupId: string, updates: Partial<Pick<GroupNodeData, 'color'>>) => void;
  ydoc: Y.Doc | null;
  internal: InternalState;
  initYDoc: (ydoc: Y.Doc) => void;
  destroyYDoc: () => void;
}

// --- Helper Functions ---

function findColumnYMap(
  colsYArray: Y.Array<Y.Map<unknown>>,
  colId: string,
): Y.Map<unknown> | undefined {
  for (let i = 0; i < colsYArray.length; i++) {
    const colYMap = colsYArray.get(i);
    if (colYMap.get('id') === colId) return colYMap;
  }
  return undefined;
}

function sanitizeTableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function generateUniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let i = 1;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

/** DDL 파싱 결과를 Y.Map에 반영할 때의 옵션 */
interface PopulateDdlOptions {
  /** 테이블 이름 변환 함수 (중복 회피 등) */
  resolveTableName: (original: string) => string;
  /** 테이블 배치 시작 Y 좌표 */
  startY: number;
}

/**
 * DDL 파싱 결과를 Y.Map(tablesMap, edgesMap)에 테이블/엣지로 반영한다.
 *
 * importDdl(APPEND)과 replaceFromDdl(REPLACE) 공통 로직.
 *
 * @param tablesMap Y.Map 테이블 맵
 * @param edgesMap  Y.Map 엣지 맵
 * @param result    DDL 파싱 결과
 * @param options   테이블 이름 변환 함수, 시작 Y 좌표
 */
function populateFromDdl(
  tablesMap: Y.Map<Y.Map<unknown>>,
  edgesMap: Y.Map<Y.Map<unknown>>,
  result: DdlParseResult,
  options: PopulateDdlOptions,
) {
  const tMap = new Map<string, { nodeId: string; colMap: Map<string, string> }>();
  const G_COLS = 4,
    G_X = 300,
    G_Y = 250,
    SX = 100;
  const { resolveTableName, startY: SY } = options;
  result.tables.forEach((table, idx) => {
    const name = resolveTableName(table.name);
    const nid = `table-${crypto.randomUUID()}`,
      cMap = new Map<string, string>();
    const cols = table.columns.map((col) => {
      const cid = `col-${crypto.randomUUID()}`;
      cMap.set(col.name, cid);
      return {
        id: cid,
        name: col.name,
        type: col.type,
        pk: col.pk || undefined,
        fk: undefined,
        nullable: col.nullable,
        autoIncrement: col.autoIncrement || undefined,
        logicalName: col.logicalName || col.comment || undefined,
        termId: col.termId,
        domainId: col.domainId,
      };
    });
    tablesMap.set(
      nid,
      createTableYMap(
        name,
        { x: SX + (idx % G_COLS) * G_X, y: SY + Math.floor(idx / G_COLS) * G_Y },
        cols,
        {
          logicalTableName: table.logicalTableName || table.comment || undefined,
          tableTermId: table.tableTermId,
        },
      ),
    );
    tMap.set(table.name, { nodeId: nid, colMap: cMap });
  });
  result.relations.forEach((rel) => {
    const p = tMap.get(rel.parentTable),
      c = tMap.get(rel.childTable);
    if (!p || !c) return;
    const pcid = p.colMap.get(rel.parentColumn),
      ccid = c.colMap.get(rel.childColumn);
    if (!pcid || !ccid) return;
    const cTable = tablesMap.get(c.nodeId);
    if (cTable) {
      const cols = cTable.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (cols) {
        const cy = findColumnYMap(cols, ccid);
        if (cy) cy.set('fk', true);
      }
    }
    const sh = `${p.nodeId}-${pcid}-source`,
      th = `${c.nodeId}-${ccid}-target`;
    edgesMap.set(`e-${sh}-${th}`, createEdgeYMap(p.nodeId, c.nodeId, sh, th, 'non-identifying'));
  });
}

// --- Store ---

const useCanvasStore = create<CanvasState>((set, get) => {
  const POSITION_SYNC_ORIGIN = 'local-position-sync';

  function queuePositionToYDoc(changes: NodeChange[], ctx: PositionQueueCtx) {
    const posChanges = changes.filter(
      (c) => c.type === 'position' && 'position' in c && c.position,
    );
    if (posChanges.length === 0) return;
    for (const change of posChanges) {
      if (change.type === 'position' && 'position' in change && change.position) {
        ctx.pending.set(change.id, change.position);
      }
    }
  }

  function flushQueuedPositionsToYDoc(
    ctx: PositionQueueCtx,
    getYMap: (doc: Y.Doc) => Y.Map<Y.Map<unknown>>,
  ) {
    const ydoc = get().ydoc;
    if (!ydoc || ctx.pending.size === 0) return;
    ydoc.transact(() => {
      const yMap = getYMap(ydoc);
      for (const [nodeId, pos] of ctx.pending) {
        const nodeYMap = yMap.get(nodeId);
        if (!nodeYMap) continue;
        const posYMap = nodeYMap.get('position') as Y.Map<number> | undefined;
        if (posYMap) {
          posYMap.set('x', pos.x);
          posYMap.set('y', pos.y);
        }
      }
    }, POSITION_SYNC_ORIGIN);
    ctx.pending.clear();
  }

  function applyPositionChangesFast<T extends Node>(
    current: T[],
    changes: NodeChange[],
  ): T[] | null {
    if (changes.length === 0) return current;
    if (!changes.every((c) => c.type === 'position')) return null;
    const posChangeById = new Map<string, NodeChange>();
    for (const change of changes) {
      if ('id' in change && typeof change.id === 'string') posChangeById.set(change.id, change);
    }
    if (posChangeById.size === 0) return current;
    let mutated = false;
    const next = current.map((node) => {
      const change = posChangeById.get(node.id);
      if (!change || change.type !== 'position') return node;
      const nextPosition =
        'position' in change && change.position ? change.position : node.position;
      const nextDragging = 'dragging' in change ? change.dragging : node.dragging;
      if (
        nextPosition.x === node.position.x &&
        nextPosition.y === node.position.y &&
        nextDragging === node.dragging
      )
        return node;
      mutated = true;
      return { ...node, position: nextPosition, dragging: nextDragging } as T;
    });
    return mutated ? next : current;
  }

  return {
    nodes: [],
    groupNodes: [],
    edges: [],
    highlightedNodeIds: [],
    highlightedEdgeId: null,
    activeEditNodeId: null,
    setActiveEditNodeId: (id) => set({ activeEditNodeId: id }),
    lastBackupHash: '',
    ydoc: null,
    internal: {
      tablesObserver: null,
      edgesObserver: null,
      groupsObserver: null,
      isNodeDragging: false,
      hasDeferredTableSync: false,
      groupNodeIds: new Set(),
      tablePositionQueue: { pending: new Map() },
      groupPositionQueue: { pending: new Map() },
    },

    initYDoc: (ydoc) => {
      const tablesMap = getTablesMap(ydoc);
      const edgesMap = getEdgesMap(ydoc);
      const groupsMap = getGroupsMap(ydoc);
      const initialGroupNodes = yGroupsMapToNodes(groupsMap);
      const internal = get().internal;
      internal.groupNodeIds = new Set(initialGroupNodes.map((g) => g.id));

      set({
        nodes: yTablesMapToNodes(tablesMap),
        edges: yEdgesMapToEdges(edgesMap),
        groupNodes: initialGroupNodes,
        ydoc,
        lastBackupHash: djb2(yDocToJson(ydoc)),
      });

      internal.tablesObserver = (events) => {
        const isLocalPositionSync =
          events.length > 0 &&
          events.every((event) => event.transaction.origin === POSITION_SYNC_ORIGIN);
        if (isLocalPositionSync) return;
        if (get().internal.isNodeDragging) {
          get().internal.hasDeferredTableSync = true;
          return;
        }
        set({ nodes: yTablesMapToNodes(tablesMap) });
      };
      internal.edgesObserver = () => {
        set({ edges: yEdgesMapToEdges(edgesMap) });
      };
      internal.groupsObserver = () => {
        const newGroupNodes = yGroupsMapToNodes(groupsMap);
        get().internal.groupNodeIds = new Set(newGroupNodes.map((g) => g.id));
        set({ groupNodes: newGroupNodes });
      };
      tablesMap.observeDeep(internal.tablesObserver);
      edgesMap.observeDeep(internal.edgesObserver);
      groupsMap.observeDeep(internal.groupsObserver);
    },

    destroyYDoc: () => {
      const { ydoc, internal } = get();
      if (ydoc) {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        const groupsMap = getGroupsMap(ydoc);
        if (internal.tablesObserver) tablesMap.unobserveDeep(internal.tablesObserver);
        if (internal.edgesObserver) edgesMap.unobserveDeep(internal.edgesObserver);
        if (internal.groupsObserver) groupsMap.unobserveDeep(internal.groupsObserver);
        ydoc.destroy();
      }
      internal.tablesObserver = null;
      internal.edgesObserver = null;
      internal.groupsObserver = null;
      internal.tablePositionQueue.pending.clear();
      internal.groupPositionQueue.pending.clear();
      internal.isNodeDragging = false;
      internal.hasDeferredTableSync = false;
      internal.groupNodeIds = new Set();
      set({
        ydoc: null,
        nodes: [],
        edges: [],
        groupNodes: [],
        lastBackupHash: '',
        activeEditNodeId: null,
      });
    },

    onNodesChange: (changes) => {
      const internal = get().internal;
      const isGroupId = (id: string) =>
        internal.groupNodeIds.has(id) || get().groupNodes.some((g) => g.id === id);
      const tableChanges =
        internal.groupNodeIds.size > 0
          ? changes.filter((c) => !('id' in c && isGroupId(c.id)))
          : changes;
      const groupChanges =
        internal.groupNodeIds.size > 0 ? changes.filter((c) => 'id' in c && isGroupId(c.id)) : [];
      let shouldSyncDeferredTables = false;

      for (const change of changes) {
        if (change.type === 'position' && 'dragging' in change) {
          if (change.dragging === true) internal.isNodeDragging = true;
          else if (change.dragging === false) {
            internal.isNodeDragging = false;
            if (internal.hasDeferredTableSync) {
              internal.hasDeferredTableSync = false;
              shouldSyncDeferredTables = true;
            }
          }
        }
      }

      if (tableChanges.length > 0) {
        const currentNodes = get().nodes;
        const fastNodes = applyPositionChangesFast(currentNodes, tableChanges);
        set({
          nodes:
            fastNodes ?? (applyNodeChanges(tableChanges, currentNodes) as Node<TableNodeData>[]),
        });
      }
      if (groupChanges.length > 0) {
        const currentGroupNodes = get().groupNodes;
        const fastGroupNodes = applyPositionChangesFast(currentGroupNodes, groupChanges);
        set({
          groupNodes:
            fastGroupNodes ??
            (applyNodeChanges(groupChanges, currentGroupNodes) as Node<GroupNodeData>[]),
        });
      }

      queuePositionToYDoc(tableChanges, internal.tablePositionQueue);
      queuePositionToYDoc(groupChanges, internal.groupPositionQueue);
      if (!internal.isNodeDragging) {
        flushQueuedPositionsToYDoc(internal.tablePositionQueue, getTablesMap);
        flushQueuedPositionsToYDoc(internal.groupPositionQueue, getGroupsMap);
      }
      if (shouldSyncDeferredTables) {
        const doc = get().ydoc;
        if (doc) set({ nodes: yTablesMapToNodes(getTablesMap(doc)) });
      }
    },

    onEdgesChange: (changes) => {
      const filtered = changes.filter((c) => c.type !== 'remove');
      set({ edges: applyEdgeChanges(filtered, get().edges) });
    },

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    markBackedUp: (hash) => set({ lastBackupHash: hash }),
    prepareBackup: () => {
      const { ydoc, lastBackupHash } = get();
      if (!ydoc) return null;
      const content = yDocToJson(ydoc);
      const hash = djb2(content);
      return hash === lastBackupHash ? null : { content, hash };
    },
    setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),
    setHighlightedEdge: (id) => set({ highlightedEdgeId: id }),
    clearHighlights: () => set({ highlightedNodeIds: [], highlightedEdgeId: null }),
    removeEdge: (edgeId) => {
      const { ydoc } = get();
      if (!ydoc) return;
      getEdgesMap(ydoc).delete(edgeId);
      set({ highlightedEdgeId: null, highlightedNodeIds: [] });
    },
    removeEdgeWithFkColumn: (edgeId) => {
      const { ydoc, edges } = get();
      if (!ydoc) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const targetNodeId = edge.target;
      const targetHandle = edge.targetHandle;
      ydoc.transact(() => {
        getEdgesMap(ydoc).delete(edgeId);
        if (targetHandle) {
          const colId = extractColId(targetHandle, targetNodeId);
          const tablesMap = getTablesMap(ydoc);
          const tableYMap = tablesMap.get(targetNodeId);
          if (tableYMap) {
            const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
            if (colsYArray) deleteColumnFromYArray(colsYArray, colId);
          }
        }
      });
      set({ highlightedEdgeId: null, highlightedNodeIds: [] });
    },
    applyLayout: (nodes) => {
      const { ydoc } = get();
      if (!ydoc) return;
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        for (const node of nodes) {
          const tableYMap = tablesMap.get(node.id);
          if (!tableYMap) continue;
          const posYMap = tableYMap.get('position') as Y.Map<number> | undefined;
          if (posYMap) {
            posYMap.set('x', node.position.x);
            posYMap.set('y', node.position.y);
          }
        }
      });
    },
    addTable: (name) => {
      const { ydoc, nodes } = get();
      if (!ydoc) return;
      const tableId = `table-${crypto.randomUUID()}`;
      const tableName = name ?? `Table ${nodes.length + 1}`;
      let x = 100,
        y = 100;
      if (nodes.length > 0) {
        const maxX = Math.max(...nodes.map((n) => (n.position?.x ?? 0) + 220));
        x = maxX + 40;
        y = nodes[0]?.position?.y ?? 100;
      }
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        tablesMap.set(
          tableId,
          createTableYMap(tableName, { x, y }, [
            {
              id: `col-${crypto.randomUUID()}`,
              name: 'id',
              type: 'BIGINT',
              pk: true,
              nullable: false,
            },
          ]),
        );
      });
    },
    deleteTable: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) return;
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        tablesMap.delete(nodeId);
        const toDelete: string[] = [];
        edgesMap.forEach((ey, eid) => {
          if (ey.get('source') === nodeId || ey.get('target') === nodeId) toDelete.push(eid);
        });
        toDelete.forEach((eid) => edgesMap.delete(eid));
      });
      if (get().activeEditNodeId === nodeId) {
        set({ activeEditNodeId: null });
      }
    },
    renameTable: (nodeId, newName) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (tableYMap) tableYMap.set('label', newName);
    },
    updateTableMeta: (nodeId, updates) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (!tableYMap) return;
      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === null) tableYMap.delete(key);
          else if (key === 'headerColor' && value === 'default') tableYMap.delete('headerColor');
          else tableYMap.set(key, value);
        }
      });
    },
    addColumn: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (!tableYMap) return;
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (colsYArray)
        colsYArray.push([
          createColumnYMap({
            id: `col-${crypto.randomUUID()}`,
            name: 'column',
            type: 'VARCHAR(255)',
            nullable: true,
          }),
        ]);
    },
    deleteColumn: (nodeId, colId) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const handlePrefix = `${nodeId}-${colId}`;
      ydoc.transact(() => {
        const tableYMap = getTablesMap(ydoc).get(nodeId);
        if (tableYMap) {
          const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
          if (colsYArray) deleteColumnFromYArray(colsYArray, colId);
        }
        const edgesMap = getEdgesMap(ydoc);
        const toDelete: string[] = [];
        edgesMap.forEach((ey, eid) => {
          const sh = ey.get('sourceHandle') as string | undefined;
          const th = ey.get('targetHandle') as string | undefined;
          if (sh?.startsWith(handlePrefix) || th?.startsWith(handlePrefix)) toDelete.push(eid);
        });
        toDelete.forEach((eid) => edgesMap.delete(eid));
      });
    },
    updateColumn: (nodeId, colId, updates) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (!tableYMap) return;
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (!colsYArray) return;
      const colYMap = findColumnYMap(colsYArray, colId);
      if (!colYMap) return;
      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined) colYMap.delete(key);
          else colYMap.set(key, value);
        }
        if ('pk' in updates || 'fk' in updates) {
          const isPk = !!colYMap.get('pk'),
            isFk = !!colYMap.get('fk');
          const thId = `${nodeId}-${colId}-target`;
          getEdgesMap(ydoc).forEach((ey) => {
            if (ey.get('targetHandle') === thId)
              ey.set('relationType', isPk && isFk ? 'identifying' : 'non-identifying');
          });
        }
      });
    },
    moveColumn: (nodeId, fromIndex, toIndex) => {
      const { ydoc } = get();
      if (!ydoc || fromIndex === toIndex) return;
      const tableYMap = getTablesMap(ydoc).get(nodeId);
      if (tableYMap) {
        const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
        if (colsYArray) ydoc.transact(() => moveColumnInYArray(colsYArray, fromIndex, toIndex));
      }
    },
    serialize: () => {
      const { ydoc } = get();
      return ydoc ? yDocToJson(ydoc) : JSON.stringify({ nodes: [], edges: [], groups: [] });
    },
    addFkRelation: (
      parentNodeId,
      childNodeId,
      pkColumns,
      parentLabel,
      existingNames,
      relationType,
    ) => {
      const { ydoc } = get();
      if (!ydoc) return 0;
      const prefix = sanitizeTableName(parentLabel);
      const names = [...existingNames];
      const isId = relationType === 'identifying';
      let count = 0;
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const childTableYMap = tablesMap.get(childNodeId);
        if (!childTableYMap) return;
        const colsYArray = childTableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
        if (!colsYArray) return;
        for (const pkCol of pkColumns) {
          const base = prefix ? `${prefix}_${pkCol.name}` : pkCol.name;
          const fkName = generateUniqueName(base, names);
          names.push(fkName);
          const fkColId = `col-${crypto.randomUUID()}`;
          colsYArray.push([
            createColumnYMap({
              id: fkColId,
              name: fkName,
              type: pkCol.type,
              pk: isId ? true : undefined,
              fk: true,
              nullable: !isId,
              logicalName: pkCol.logicalName,
              domainId: pkCol.domainId,
            }),
          ]);
          const sh = `${parentNodeId}-${pkCol.id}-source`,
            th = `${childNodeId}-${fkColId}-target`;
          getEdgesMap(ydoc).set(
            `e-${sh}-${th}`,
            createEdgeYMap(parentNodeId, childNodeId, sh, th, relationType),
          );
          count++;
        }
      });
      return count;
    },
    connectWithRelationType: (source, target, sourceHandle, targetHandle, relationType) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const isId = relationType === 'identifying';
      ydoc.transact(() => {
        getEdgesMap(ydoc).set(
          `e-${sourceHandle}-${targetHandle}`,
          createEdgeYMap(source, target, sourceHandle, targetHandle, relationType),
        );
        if (targetHandle) {
          const colId = extractColId(targetHandle, target);
          const tableYMap = getTablesMap(ydoc).get(target);
          if (tableYMap) {
            const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
            if (colsYArray) {
              const colYMap = findColumnYMap(colsYArray, colId);
              if (colYMap) {
                colYMap.set('fk', true);
                if (isId) {
                  colYMap.set('pk', true);
                  colYMap.set('nullable', false);
                }
              }
            }
          }
        }
      });
    },
    importDdl: (result) => {
      const { ydoc, nodes } = get();
      if (!ydoc || result.tables.length === 0) return;
      const assigned = new Set(nodes.map((n) => n.data.label));
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        const startY =
          nodes.length > 0 ? Math.max(...nodes.map((n) => n.position?.y ?? 0)) + 300 : 100;
        populateFromDdl(tablesMap, edgesMap, result, {
          resolveTableName: (name) => {
            const unique = generateUniqueName(name, [...assigned]);
            assigned.add(unique);
            return unique;
          },
          startY,
        });
      });
    },
    replaceFromDdl: (result) => {
      const { ydoc } = get();
      if (!ydoc || result.tables.length === 0) return;
      const assigned = new Set<string>();
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        // 기존 테이블/엣지 전체 삭제 (그룹 노드는 보존)
        for (const key of [...tablesMap.keys()]) tablesMap.delete(key);
        for (const key of [...edgesMap.keys()]) edgesMap.delete(key);
        populateFromDdl(tablesMap, edgesMap, result, {
          resolveTableName: (name) => {
            const unique = generateUniqueName(name, [...assigned]);
            assigned.add(unique);
            return unique;
          },
          startY: 100,
        });
      });
    },
    addGroup: (label) => {
      const { ydoc, groupNodes } = get();
      if (!ydoc) return;
      const gid = `group-${crypto.randomUUID()}`,
        gl = label ?? `Group ${groupNodes.length + 1}`;
      ydoc.transact(() =>
        getGroupsMap(ydoc).set(gid, createGroupYMap(gl, { x: 100, y: 100 }, 400, 300)),
      );
    },
    deleteGroup: (groupId) => {
      const { ydoc } = get();
      if (ydoc) getGroupsMap(ydoc).delete(groupId);
    },
    renameGroup: (groupId, newName) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const gy = getGroupsMap(ydoc).get(groupId);
      if (gy) gy.set('label', newName);
    },
    resizeGroup: (groupId, width, height) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const gy = getGroupsMap(ydoc).get(groupId);
      if (gy)
        ydoc.transact(() => {
          gy.set('width', width);
          gy.set('height', height);
        });
    },
    updateGroupMeta: (groupId, updates) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const gy = getGroupsMap(ydoc).get(groupId);
      if (!gy) return;
      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === null || (key === 'color' && value === 'default'))
            gy.delete(key);
          else gy.set(key, value);
        }
      });
    },
  };
});

export default useCanvasStore;
