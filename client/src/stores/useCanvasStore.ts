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

/**
 * Handle ID에서 컬럼 ID를 추출한다.
 *
 * @param handleId Handle ID (형식: `{nodeId}-{colId}-source/target`)
 * @param nodeId   노드 ID
 * @returns 컬럼 ID
 */
export function extractColId(handleId: string, nodeId: string): string {
  return handleId.replace(`${nodeId}-`, '').replace(/-(?:source|target)$/, '');
}

/**
 * ERD 캔버스 상태를 관리하는 Zustand 스토어의 상태 인터페이스.
 *
 * Y.Doc이 SSOT(Single Source of Truth)이며, Zustand은 읽기 캐시 역할을 한다.
 * 모든 변이는 Y.Doc을 직접 변경하고, observeDeep으로 자동 갱신된다.
 */
interface CanvasState {
  /** 캔버스에 표시되는 테이블 노드 목록 */
  nodes: Node<TableNodeData>[];
  /** 그룹 노드 목록 (테이블 노드와 분리 관리) */
  groupNodes: Node<GroupNodeData>[];
  /** 테이블 간 관계를 나타내는 엣지 목록 */
  edges: Edge[];
  /** 하이라이트할 노드 ID 배열 */
  highlightedNodeIds: string[];
  /** 하이라이트할 엣지 ID */
  highlightedEdgeId: string | null;
  /** 노드 변경(이동, 선택, 삭제 등) 이벤트 핸들러 */
  onNodesChange: OnNodesChange;
  /** 엣지 변경(선택 등) 이벤트 핸들러 — remove 타입은 필터링하여 커스텀 삭제만 허용 */
  onEdgesChange: OnEdgesChange;
  /** 노드 목록을 직접 설정한다. @param nodes 설정할 노드 배열 */
  setNodes: (nodes: Node<TableNodeData>[]) => void;
  /** 엣지 목록을 직접 설정한다. @param edges 설정할 엣지 배열 */
  setEdges: (edges: Edge[]) => void;
  /** 마지막 백업 시점의 해시값 */
  lastBackupHash: string;
  /** 백업 완료 후 해시를 갱신한다. @param hash 백업된 콘텐츠의 해시 */
  markBackedUp: (hash: string) => void;
  /**
   * 백업이 필요한 경우 콘텐츠와 해시를 반환한다.
   * 변경이 없으면 null을 반환하여 불필요한 서버 호출을 방지한다.
   *
   * @returns { content, hash } 또는 null
   */
  prepareBackup: () => { content: string; hash: string } | null;
  /** 새 테이블을 캔버스에 추가한다. @param name 테이블 이름 (미지정 시 자동 생성) */
  addTable: (name?: string) => void;
  /** 테이블을 캔버스에서 삭제한다 (관련 엣지도 제거). @param nodeId 삭제할 노드 ID */
  deleteTable: (nodeId: string) => void;
  /** 테이블 이름을 변경한다. @param nodeId 대상 노드 ID @param newName 새 이름 */
  renameTable: (nodeId: string, newName: string) => void;
  /**
   * 테이블 메타데이터를 업데이트한다 (논리명, termId, 색상 등).
   *
   * @param nodeId  대상 노드 ID
   * @param updates 변경할 속성
   */
  updateTableMeta: (
    nodeId: string,
    updates: Partial<
      Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId' | 'headerColor'>
    >,
  ) => void;
  /** 테이블에 새 컬럼을 추가한다. @param nodeId 대상 노드 ID */
  addColumn: (nodeId: string) => void;
  /** 테이블에서 컬럼을 삭제한다. @param nodeId 대상 노드 ID @param colId 삭제할 컬럼 ID */
  deleteColumn: (nodeId: string, colId: string) => void;
  /** 컬럼 속성을 업데이트한다. @param nodeId 대상 노드 ID @param colId 대상 컬럼 ID @param updates 변경할 속성 */
  updateColumn: (nodeId: string, colId: string, updates: Partial<Column>) => void;
  /**
   * 컬럼 위치를 이동한다 (드래그 앤 드롭).
   *
   * @param nodeId    대상 노드 ID
   * @param fromIndex 이동 전 인덱스
   * @param toIndex   이동 후 인덱스
   */
  moveColumn: (nodeId: string, fromIndex: number, toIndex: number) => void;
  /** 노드 하이라이트를 설정한다. @param ids 하이라이트할 노드 ID 배열 */
  setHighlightedNodes: (ids: string[]) => void;
  /** 엣지 하이라이트를 설정한다. @param id 하이라이트할 엣지 ID (null이면 해제) */
  setHighlightedEdge: (id: string | null) => void;
  /** 모든 하이라이트를 해제한다. */
  clearHighlights: () => void;
  /** 엣지만 삭제한다 (FK 컬럼 유지). @param edgeId 삭제할 엣지 ID */
  removeEdge: (edgeId: string) => void;
  /** 엣지와 FK 컬럼을 함께 삭제한다. @param edgeId 삭제할 엣지 ID */
  removeEdgeWithFkColumn: (edgeId: string) => void;
  /** 자동 배치 결과를 적용한다. @param nodes 배치된 노드 배열 */
  applyLayout: (nodes: Node<TableNodeData>[]) => void;
  /** 현재 노드·엣지 상태를 JSON 문자열로 직렬화한다. @returns 직렬화된 JSON */
  serialize: () => string;
  /**
   * FK 관계를 원자적으로 생성한다 (FK 컬럼 + 엣지).
   *
   * @param parentNodeId  부모 테이블 노드 ID
   * @param childNodeId   자식 테이블 노드 ID
   * @param pkColumns     부모 테이블의 PK 컬럼 배열
   * @param parentLabel   부모 테이블 이름 (FK 컬럼명 접두사)
   * @param existingNames 자식 테이블의 기존 컬럼명 배열 (중복 방지용)
   * @param relationType  관계 유형 (식별/비식별)
   * @returns 생성된 FK 관계 수
   */
  addFkRelation: (
    parentNodeId: string,
    childNodeId: string,
    pkColumns: Column[],
    parentLabel: string,
    existingNames: string[],
    relationType: RelationType,
  ) => number;
  /**
   * Handle 드래그로 FK 관계를 생성한다 (엣지 + 대상 컬럼 FK 마킹).
   *
   * @param source       부모 노드 ID
   * @param target       자식 노드 ID
   * @param sourceHandle 부모 Handle ID
   * @param targetHandle 자식 Handle ID
   * @param relationType 관계 유형 (식별/비식별)
   */
  connectWithRelationType: (
    source: string,
    target: string,
    sourceHandle: string | undefined,
    targetHandle: string | undefined,
    relationType: RelationType,
  ) => void;
  /**
   * DDL 파싱 결과를 ERD에 임포트한다.
   *
   * @param result DDL 파싱 결과
   */
  importDdl: (result: DdlParseResult) => void;
  /** 그룹 노드를 추가한다. @param label 그룹 이름 (미지정 시 자동 생성) */
  addGroup: (label?: string) => void;
  /** 그룹 노드를 삭제한다. @param groupId 삭제할 그룹 ID */
  deleteGroup: (groupId: string) => void;
  /** 그룹 이름을 변경한다. @param groupId 대상 그룹 ID @param newName 새 이름 */
  renameGroup: (groupId: string, newName: string) => void;
  /**
   * 그룹 크기를 변경한다.
   *
   * @param groupId 대상 그룹 ID
   * @param width   새 너비
   * @param height  새 높이
   */
  resizeGroup: (groupId: string, width: number, height: number) => void;
  /**
   * 그룹 메타데이터를 업데이트한다 (색상 등).
   *
   * @param groupId 대상 그룹 ID
   * @param updates 변경할 속성
   */
  updateGroupMeta: (groupId: string, updates: Partial<Pick<GroupNodeData, 'color'>>) => void;
  /** Y.Doc 참조 (null이면 초기화 전) */
  ydoc: Y.Doc | null;
  /** Y.Doc을 초기화하고 observer를 등록한다. @param ydoc Y.Doc 인스턴스 */
  initYDoc: (ydoc: Y.Doc) => void;
  /** Y.Doc observer를 해제하고 상태를 초기화한다. */
  destroyYDoc: () => void;
}

/**
 * Y.Doc에서 테이블 Y.Map을 가져오는 헬퍼.
 *
 * @param ydoc    Y.Doc
 * @param tableId 테이블 ID
 * @returns 테이블 Y.Map 또는 undefined
 */
function getTableYMap(ydoc: Y.Doc, tableId: string): Y.Map<unknown> | undefined {
  const tablesMap = getTablesMap(ydoc);
  return tablesMap.get(tableId);
}

/**
 * Y.Array에서 컬럼 ID로 Y.Map을 찾는다.
 *
 * @param colsYArray 컬럼 Y.Array
 * @param colId      검색할 컬럼 ID
 * @returns 해당 컬럼의 Y.Map 또는 undefined
 */
function findColumnYMap(
  colsYArray: Y.Array<Y.Map<unknown>>,
  colId: string,
): Y.Map<unknown> | undefined {
  for (let i = 0; i < colsYArray.length; i++) {
    const colYMap = colsYArray.get(i);
    if (colYMap.get('id') === colId) {
      return colYMap;
    }
  }
  return undefined;
}

/**
 * 테이블명을 FK 컬럼명 접두사로 사용할 수 있도록 정규화한다.
 *
 * @param name 테이블명
 * @returns 정규화된 문자열
 */
function sanitizeTableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * 기존 컬럼명 목록에서 중복되지 않는 고유한 이름을 생성한다.
 *
 * @param base     기본 컬럼명
 * @param existing 기존 컬럼명 배열
 * @returns 고유한 컬럼명
 */
function generateUniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let i = 1;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

/**
 * 기존 테이블명 목록에서 중복되지 않는 고유한 테이블명을 생성한다.
 *
 * @param base     기본 테이블명
 * @param existing 기존 테이블명 배열
 * @returns 고유한 테이블명
 */
function generateUniqueTableName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let i = 1;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

/**
 * ERD 캔버스 상태 관리 Zustand 스토어.
 *
 * Y.Doc이 SSOT이며, 모든 변이는 Y.Doc을 직접 변경한다.
 * observeDeep 콜백에서 Zustand 상태(nodes, edges, groupNodes)가 자동 갱신된다.
 *
 * @remarks
 * `applyNodeChanges()`는 제네릭 `Node[]`를 반환하므로 `Node<TableNodeData>[]`로 타입 단언이 필요하다.
 *
 * 엣지 ID 규칙: `e-{sourceHandle}-{targetHandle}`
 */
const useCanvasStore = create<CanvasState>((set, get) => {
  /**
   * observeDeep 콜백 참조 (cleanup용).
   * Zustand 외부 — 콜백 참조는 직렬화 불가하며, state 저장 시 불필요한 re-render를 유발하므로 클로저 스코프에 유지.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tablesObserver: ((events: Y.YEvent<any>[]) => void) | null = null;
  /**
   * observeDeep 콜백 참조 (cleanup용).
   * Zustand 외부 — 콜백 참조는 직렬화 불가하며, state 저장 시 불필요한 re-render를 유발하므로 클로저 스코프에 유지.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let edgesObserver: ((events: Y.YEvent<any>[]) => void) | null = null;
  /**
   * groups observeDeep 콜백 참조 (cleanup용).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let groupsObserver: ((events: Y.YEvent<any>[]) => void) | null = null;
  /** 로컬 position 동기화 트랜잭션 origin 식별자 */
  const POSITION_SYNC_ORIGIN = 'local-position-sync';
  /**
   * 노드 드래그 중 여부 (드래그 중 observer 전체 재세팅 방지용).
   * Zustand 외부 — 드래그 중 매 mousemove마다 변경되므로 set() 시 과도한 re-render 발생. 클로저 스코프에서 플래그로만 사용.
   */
  let isNodeDragging = false;
  /**
   * 드래그 중 들어온 원격 테이블 변경의 지연 동기화 필요 여부.
   * Zustand 외부 — isNodeDragging과 동기적으로 판단하는 플래그로, re-render 없이 읽기/쓰기가 필요하므로 클로저 스코프에 유지.
   */
  let hasDeferredTableSync = false;
  /**
   * position 동기화 대기 큐.
   * 드래그 중에는 Y.Doc 반영을 지연하고, 드래그 종료 시 한 번에 flush한다.
   */
  interface PositionQueueCtx {
    pending: Map<string, { x: number; y: number }>;
  }
  /** 테이블 position 대기 큐 */
  const tablePositionQueue: PositionQueueCtx = { pending: new Map() };
  /** 그룹 position 대기 큐 */
  const groupPositionQueue: PositionQueueCtx = { pending: new Map() };

  /**
   * position 변경을 동기화 대기 큐에 누적한다.
   *
   * @param changes   position 타입의 NodeChange 배열
   * @param ctx       position 대기 큐 컨텍스트 (테이블 또는 그룹)
   */
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

  /**
   * 누적된 position 변경을 Y.Doc에 반영한다.
   *
   * @param ctx       position 대기 큐 컨텍스트 (테이블 또는 그룹)
   * @param getYMap   Y.Doc에서 대상 Y.Map을 가져오는 함수
   */
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

  /**
   * position 전용 NodeChange를 경량 경로로 적용한다.
   *
   * @returns position 전용이 아니면 null, 전용이면 변경 적용 결과 배열
   */
  function applyPositionChangesFast<T extends Node>(current: T[], changes: NodeChange[]): T[] | null {
    if (changes.length === 0) return current;
    if (!changes.every((c) => c.type === 'position')) return null;

    const posChangeById = new Map<string, NodeChange>();
    for (const change of changes) {
      if ('id' in change && typeof change.id === 'string') {
        posChangeById.set(change.id, change);
      }
    }
    if (posChangeById.size === 0) return current;

    let mutated = false;
    const next = current.map((node) => {
      const change = posChangeById.get(node.id);
      if (!change || change.type !== 'position') return node;

      const nextPosition =
        'position' in change && change.position ? change.position : node.position;
      const nextDragging =
        'dragging' in change ? change.dragging : (node as Node & { dragging?: boolean }).dragging;

      if (
        nextPosition.x === node.position.x &&
        nextPosition.y === node.position.y &&
        nextDragging === (node as Node & { dragging?: boolean }).dragging
      ) {
        return node;
      }

      mutated = true;
      return {
        ...node,
        position: nextPosition,
        dragging: nextDragging,
      } as T;
    });

    return mutated ? next : current;
  }

  /** 그룹 노드 ID 셋 (onNodesChange에서 빠른 분기 판별용) */
  let groupNodeIds: Set<string> = new Set();

  return {
    nodes: [],
    groupNodes: [],
    edges: [],
    highlightedNodeIds: [],
    highlightedEdgeId: null,
    lastBackupHash: '',
    ydoc: null,

    initYDoc: (ydoc) => {
      const tablesMap = getTablesMap(ydoc);
      const edgesMap = getEdgesMap(ydoc);
      const groupsMap = getGroupsMap(ydoc);

      const initialGroupNodes = yGroupsMapToNodes(groupsMap);
      groupNodeIds = new Set(initialGroupNodes.map((g) => g.id));

      // 초기 렌더링 + 초기 해시 설정
      set({
        nodes: yTablesMapToNodes(tablesMap),
        edges: yEdgesMapToEdges(edgesMap),
        groupNodes: initialGroupNodes,
        ydoc,
        lastBackupHash: djb2(yDocToJson(ydoc)),
      });

      // observeDeep: Y.Doc 변경 시 자동으로 Zustand 상태 갱신
      tablesObserver = (events) => {
        const isLocalPositionSync =
          events.length > 0 &&
          events.every((event) => event.transaction.origin === POSITION_SYNC_ORIGIN);
        if (isLocalPositionSync) {
          return;
        }
        if (isNodeDragging) {
          hasDeferredTableSync = true;
          return;
        }
        set({ nodes: yTablesMapToNodes(tablesMap) });
      };
      edgesObserver = () => {
        set({ edges: yEdgesMapToEdges(edgesMap) });
      };
      groupsObserver = () => {
        const newGroupNodes = yGroupsMapToNodes(groupsMap);
        groupNodeIds = new Set(newGroupNodes.map((g) => g.id));
        set({ groupNodes: newGroupNodes });
      };
      tablesMap.observeDeep(tablesObserver);
      edgesMap.observeDeep(edgesObserver);
      groupsMap.observeDeep(groupsObserver);
    },

    destroyYDoc: () => {
      const { ydoc } = get();

      // observer 해제
      if (ydoc) {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        const groupsMap = getGroupsMap(ydoc);
        if (tablesObserver) tablesMap.unobserveDeep(tablesObserver);
        if (edgesObserver) edgesMap.unobserveDeep(edgesObserver);
        if (groupsObserver) groupsMap.unobserveDeep(groupsObserver);
        ydoc.destroy();
      }

      tablesObserver = null;
      edgesObserver = null;
      groupsObserver = null;

      // position 동기화 큐 정리
      tablePositionQueue.pending.clear();
      groupPositionQueue.pending.clear();
      isNodeDragging = false;
      hasDeferredTableSync = false;
      groupNodeIds = new Set();

      set({ ydoc: null, nodes: [], edges: [], groupNodes: [], lastBackupHash: '' });
    },

    onNodesChange: (changes) => {
      // 테이블 변경과 그룹 변경 분리 (C-3 해결)
      // groupNodeIds 동기화 타이밍 방어: 클로저 캐시 miss 시 실제 상태 확인
      const hasGroups = groupNodeIds.size > 0;
      const isGroupId = (id: string) =>
        groupNodeIds.has(id) || get().groupNodes.some((g) => g.id === id);
      const tableChanges = hasGroups
        ? changes.filter((c) => !('id' in c && isGroupId(c.id)))
        : changes;
      const groupChanges = hasGroups
        ? changes.filter((c) => 'id' in c && isGroupId(c.id))
        : [];
      let shouldSyncDeferredTables = false;

      for (const change of changes) {
        if (change.type === 'position' && 'dragging' in change) {
          if (change.dragging === true) {
            isNodeDragging = true;
          } else if (change.dragging === false) {
            isNodeDragging = false;
            if (hasDeferredTableSync) {
              hasDeferredTableSync = false;
              shouldSyncDeferredTables = true;
            }
          }
        }
      }

      // 로컬 상태 즉시 반영
      if (tableChanges.length > 0) {
        const currentNodes = get().nodes;
        const fastNodes = applyPositionChangesFast(currentNodes, tableChanges);
        set({
          nodes:
            fastNodes ??
            (applyNodeChanges(tableChanges, currentNodes) as Node<TableNodeData>[]),
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

      // position 변경은 큐에 누적하고, 드래그 종료 시에만 Y.Doc에 반영
      queuePositionToYDoc(tableChanges, tablePositionQueue);
      queuePositionToYDoc(groupChanges, groupPositionQueue);
      if (!isNodeDragging) {
        flushQueuedPositionsToYDoc(tablePositionQueue, getTablesMap);
        flushQueuedPositionsToYDoc(groupPositionQueue, getGroupsMap);
      }

      if (shouldSyncDeferredTables) {
        const doc = get().ydoc;
        if (doc) {
          set({ nodes: yTablesMapToNodes(getTablesMap(doc)) });
        }
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
      if (!ydoc) {
        return null;
      }
      const content = yDocToJson(ydoc);
      const hash = djb2(content);
      if (hash === lastBackupHash) {
        return null;
      }
      return { content, hash };
    },

    setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),
    setHighlightedEdge: (id) => set({ highlightedEdgeId: id }),
    clearHighlights: () => set({ highlightedNodeIds: [], highlightedEdgeId: null }),

    removeEdge: (edgeId) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const edgesMap = getEdgesMap(ydoc);
      edgesMap.delete(edgeId);
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
        const edgesMap = getEdgesMap(ydoc);
        edgesMap.delete(edgeId);

        if (targetHandle) {
          const colId = extractColId(targetHandle, targetNodeId);
          const tableYMap = getTableYMap(ydoc, targetNodeId);
          if (tableYMap) {
            const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
            if (colsYArray) {
              deleteColumnFromYArray(colsYArray, colId);
            }
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

      let x = 100;
      let y = 100;
      if (nodes.length > 0) {
        const maxX = Math.max(...nodes.map((n) => (n.position?.x ?? 0) + 220));
        x = maxX + 40;
        y = nodes[0]?.position?.y ?? 100;
      }

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const tableYMap = createTableYMap(tableName, { x, y }, [
          {
            id: `col-${crypto.randomUUID()}`,
            name: 'id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
          },
        ]);
        tablesMap.set(tableId, tableYMap);
      });
    },

    deleteTable: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) return;

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);

        tablesMap.delete(nodeId);

        // 관련 엣지 삭제
        const edgeIdsToDelete: string[] = [];
        edgesMap.forEach((edgeYMap, edgeId) => {
          if (edgeYMap.get('source') === nodeId || edgeYMap.get('target') === nodeId) {
            edgeIdsToDelete.push(edgeId);
          }
        });
        for (const eid of edgeIdsToDelete) {
          edgesMap.delete(eid);
        }
      });
    },

    renameTable: (nodeId, newName) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const tableYMap = getTableYMap(ydoc, nodeId);
      if (tableYMap) {
        tableYMap.set('label', newName);
      }
    },

    updateTableMeta: (nodeId, updates) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const tableYMap = getTableYMap(ydoc, nodeId);
      if (!tableYMap) return;

      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === null) {
            tableYMap.delete(key);
          } else if (key === 'headerColor' && value === 'default') {
            tableYMap.delete('headerColor');
          } else {
            tableYMap.set(key, value);
          }
        }
      });
    },

    addColumn: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const tableYMap = getTableYMap(ydoc, nodeId);
      if (!tableYMap) return;
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (!colsYArray) return;

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
        const tableYMap = getTableYMap(ydoc, nodeId);
        if (tableYMap) {
          const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
          if (colsYArray) {
            deleteColumnFromYArray(colsYArray, colId);
          }
        }

        // 관련 엣지 삭제
        const edgesMap = getEdgesMap(ydoc);
        const edgeIdsToDelete: string[] = [];
        edgesMap.forEach((edgeYMap, edgeId) => {
          const sh = edgeYMap.get('sourceHandle') as string | undefined;
          const th = edgeYMap.get('targetHandle') as string | undefined;
          if (sh?.startsWith(handlePrefix) || th?.startsWith(handlePrefix)) {
            edgeIdsToDelete.push(edgeId);
          }
        });
        for (const eid of edgeIdsToDelete) {
          edgesMap.delete(eid);
        }
      });
    },

    updateColumn: (nodeId, colId, updates) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const tableYMap = getTableYMap(ydoc, nodeId);
      if (!tableYMap) return;
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (!colsYArray) return;

      const colYMap = findColumnYMap(colsYArray, colId);
      if (!colYMap) return;

      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined) {
            colYMap.delete(key);
          } else {
            colYMap.set(key, value);
          }
        }

        // PK 또는 FK 변경 시 연결된 엣지의 relationType 동기화
        if ('pk' in updates || 'fk' in updates) {
          const isPk = !!colYMap.get('pk');
          const isFk = !!colYMap.get('fk');
          const targetHandleId = `${nodeId}-${colId}-target`;
          const edgesMap = getEdgesMap(ydoc);
          edgesMap.forEach((edgeYMap) => {
            const th = edgeYMap.get('targetHandle') as string | undefined;
            if (th === targetHandleId) {
              edgeYMap.set('relationType', isPk && isFk ? 'identifying' : 'non-identifying');
            }
          });
        }
      });
    },

    moveColumn: (nodeId, fromIndex, toIndex) => {
      const { ydoc } = get();
      if (!ydoc) return;
      if (fromIndex === toIndex) return;

      const tableYMap = getTableYMap(ydoc, nodeId);
      if (!tableYMap) return;
      const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
      if (!colsYArray) return;

      ydoc.transact(() => {
        moveColumnInYArray(colsYArray, fromIndex, toIndex);
      });
    },

    serialize: () => {
      const { ydoc } = get();
      if (ydoc) {
        return yDocToJson(ydoc);
      }
      return JSON.stringify({ nodes: [], edges: [], groups: [] });
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

      const parentPrefix = sanitizeTableName(parentLabel);
      const names = [...existingNames];
      const isIdentifying = relationType === 'identifying';
      let createdCount = 0;

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);
        const childTableYMap = tablesMap.get(childNodeId);
        if (!childTableYMap) return;
        const colsYArray = childTableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
        if (!colsYArray) return;

        for (const pkCol of pkColumns) {
          const baseName = parentPrefix ? `${parentPrefix}_${pkCol.name}` : pkCol.name;
          const fkName = generateUniqueName(baseName, names);
          names.push(fkName);

          const fkColId = `col-${crypto.randomUUID()}`;

          // FK 컬럼 추가 (논리명·도메인은 부모 PK에서 상속)
          colsYArray.push([
            createColumnYMap({
              id: fkColId,
              name: fkName,
              type: pkCol.type,
              pk: isIdentifying ? true : undefined,
              fk: true,
              nullable: isIdentifying ? false : true,
              logicalName: pkCol.logicalName,
              domainId: pkCol.domainId,
            }),
          ]);

          // FK 엣지 추가
          const sourceHandle = `${parentNodeId}-${pkCol.id}-source`;
          const targetHandle = `${childNodeId}-${fkColId}-target`;
          const edgeId = `e-${sourceHandle}-${targetHandle}`;
          edgesMap.set(
            edgeId,
            createEdgeYMap(parentNodeId, childNodeId, sourceHandle, targetHandle, relationType),
          );

          createdCount++;
        }
      });

      return createdCount;
    },

    connectWithRelationType: (source, target, sourceHandle, targetHandle, relationType) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const edgeId = `e-${sourceHandle}-${targetHandle}`;
      const isIdentifying = relationType === 'identifying';

      ydoc.transact(() => {
        const edgesMap = getEdgesMap(ydoc);
        edgesMap.set(
          edgeId,
          createEdgeYMap(source, target, sourceHandle, targetHandle, relationType),
        );

        // 대상 컬럼 FK 마킹
        if (targetHandle) {
          const colId = extractColId(targetHandle, target);
          const tableYMap = getTableYMap(ydoc, target);
          if (tableYMap) {
            const colsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
            if (colsYArray) {
              const colYMap = findColumnYMap(colsYArray, colId);
              if (colYMap) {
                colYMap.set('fk', true);
                if (isIdentifying) {
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

      const existingTableNames = nodes.map((n) => n.data.label);
      const assignedTableNames = new Set(existingTableNames);

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        const edgesMap = getEdgesMap(ydoc);

        // tableName → { nodeId, columns: Map<colName, colId> } 매핑 (C-5 해결)
        const tableMap = new Map<string, { nodeId: string; colMap: Map<string, string> }>();

        // 1. 테이블 생성 — 그리드 배치로 겹침 방지
        const GRID_COLS = 4;
        const GRID_X_GAP = 300;
        const GRID_Y_GAP = 250;
        const startX = 100;
        let startY = 100;
        if (nodes.length > 0) {
          startY = Math.max(...nodes.map((n) => n.position?.y ?? 0)) + 300;
        }
        let tableIndex = 0;
        for (const table of result.tables) {
          const uniqueName = generateUniqueTableName(table.name, [...assignedTableNames]);
          assignedTableNames.add(uniqueName);
          const nodeId = `table-${crypto.randomUUID()}`;
          const colMap = new Map<string, string>();

          const columns: Column[] = table.columns.map((col) => {
            const colId = `col-${crypto.randomUUID()}`;
            colMap.set(col.name, colId);
            return {
              id: colId,
              name: col.name,
              type: col.type,
              pk: col.pk || undefined,
              fk: undefined,
              nullable: col.nullable,
              autoIncrement: col.autoIncrement || undefined,
              logicalName: col.comment || undefined,
            };
          });

          const gridCol = tableIndex % GRID_COLS;
          const gridRow = Math.floor(tableIndex / GRID_COLS);
          const tableYMap = createTableYMap(
            uniqueName,
            { x: startX + gridCol * GRID_X_GAP, y: startY + gridRow * GRID_Y_GAP },
            columns,
            {
              logicalTableName: table.comment || undefined,
            },
          );
          tablesMap.set(nodeId, tableYMap);
          tableMap.set(table.name, { nodeId, colMap });
          tableIndex++;
        }

        // 2. FK 관계 생성
        for (const rel of result.relations) {
          const parentEntry = tableMap.get(rel.parentTable);
          const childEntry = tableMap.get(rel.childTable);
          if (!parentEntry || !childEntry) continue;

          const parentColId = parentEntry.colMap.get(rel.parentColumn);
          const childColId = childEntry.colMap.get(rel.childColumn);
          if (!parentColId || !childColId) continue;

          // 자식 컬럼에 FK 마킹
          const childTableYMap = tablesMap.get(childEntry.nodeId);
          if (childTableYMap) {
            const colsYArray = childTableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
            if (colsYArray) {
              const colYMap = findColumnYMap(colsYArray, childColId);
              if (colYMap) {
                colYMap.set('fk', true);
              }
            }
          }

          // 엣지 생성
          const sourceHandle = `${parentEntry.nodeId}-${parentColId}-source`;
          const targetHandle = `${childEntry.nodeId}-${childColId}-target`;
          const edgeId = `e-${sourceHandle}-${targetHandle}`;
          edgesMap.set(
            edgeId,
            createEdgeYMap(
              parentEntry.nodeId,
              childEntry.nodeId,
              sourceHandle,
              targetHandle,
              'non-identifying',
            ),
          );
        }
      });
    },

    addGroup: (label) => {
      const { ydoc, groupNodes } = get();
      if (!ydoc) return;

      const groupId = `group-${crypto.randomUUID()}`;
      const groupLabel = label ?? `Group ${groupNodes.length + 1}`;

      ydoc.transact(() => {
        const groupsMap = getGroupsMap(ydoc);
        const groupYMap = createGroupYMap(groupLabel, { x: 100, y: 100 }, 400, 300);
        groupsMap.set(groupId, groupYMap);
      });
    },

    deleteGroup: (groupId) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const groupsMap = getGroupsMap(ydoc);
      groupsMap.delete(groupId);
    },

    renameGroup: (groupId, newName) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const groupsMap = getGroupsMap(ydoc);
      const groupYMap = groupsMap.get(groupId);
      if (groupYMap) {
        groupYMap.set('label', newName);
      }
    },

    resizeGroup: (groupId, width, height) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const groupsMap = getGroupsMap(ydoc);
      const groupYMap = groupsMap.get(groupId);
      if (groupYMap) {
        ydoc.transact(() => {
          groupYMap.set('width', width);
          groupYMap.set('height', height);
        });
      }
    },

    updateGroupMeta: (groupId, updates) => {
      const { ydoc } = get();
      if (!ydoc) return;

      const groupsMap = getGroupsMap(ydoc);
      const groupYMap = groupsMap.get(groupId);
      if (!groupYMap) return;

      ydoc.transact(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === null || (key === 'color' && value === 'default')) {
            groupYMap.delete(key);
          } else {
            groupYMap.set(key, value);
          }
        }
      });
    },
  };
});

export default useCanvasStore;
