import * as Y from 'yjs';
import { type Node, type NodeChange, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import { djb2 } from '@/lib/hash';
import { extractColId } from '@/lib/handle-id';
import {
  deleteColumnFromYArray,
  getEdgesMap,
  getGroupsMap,
  getTablesMap,
  yDocToJson,
  yEdgesMapToEdges,
  yGroupsMapToNodes,
  yTablesMapToNodes,
} from '@/collaboration/yjsBridge';
import type {
  CanvasGetState,
  CanvasSetState,
  CanvasState,
  PositionQueueCtx,
} from './canvasStoreTypes';

type CanvasSyncActionKeys =
  | 'initYDoc'
  | 'destroyYDoc'
  | 'onNodesChange'
  | 'onEdgesChange'
  | 'setNodes'
  | 'setEdges'
  | 'markBackedUp'
  | 'prepareBackup'
  | 'setHighlightedNodes'
  | 'setHighlightedEdge'
  | 'clearHighlights'
  | 'removeEdge'
  | 'removeEdgeWithFkColumn'
  | 'applyLayout'
  | 'serialize';

/**
 * 캔버스 동기화/뷰 상태 액션 팩토리.
 *
 * Y.Doc observe 연동, 노드/엣지 변경 동기화, 백업/하이라이트/직렬화 기능을 제공한다.
 */
export function createCanvasSyncActions(
  set: CanvasSetState,
  get: CanvasGetState,
): Pick<CanvasState, CanvasSyncActionKeys> {
  const POSITION_SYNC_ORIGIN = 'local-position-sync';

  function queuePositionToYDoc(changes: NodeChange[], ctx: PositionQueueCtx) {
    const posChanges = changes.filter(
      (c) => c.type === 'position' && 'position' in c && c.position,
    );
    if (posChanges.length === 0) {
      return;
    }
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
    if (!ydoc || ctx.pending.size === 0) {
      return;
    }
    ydoc.transact(() => {
      const yMap = getYMap(ydoc);
      for (const [nodeId, pos] of ctx.pending) {
        const nodeYMap = yMap.get(nodeId);
        if (!nodeYMap) {
          continue;
        }
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
    if (changes.length === 0) {
      return current;
    }
    if (!changes.every((c) => c.type === 'position')) {
      return null;
    }
    const posChangeById = new Map<string, NodeChange>();
    for (const change of changes) {
      if ('id' in change && typeof change.id === 'string') {
        posChangeById.set(change.id, change);
      }
    }
    if (posChangeById.size === 0) {
      return current;
    }
    let mutated = false;
    const next = current.map((node) => {
      const change = posChangeById.get(node.id);
      if (!change || change.type !== 'position') {
        return node;
      }
      const nextPosition =
        'position' in change && change.position ? change.position : node.position;
      const nextDragging = 'dragging' in change ? change.dragging : node.dragging;
      if (
        nextPosition.x === node.position.x &&
        nextPosition.y === node.position.y &&
        nextDragging === node.dragging
      ) {
        return node;
      }
      mutated = true;
      return { ...node, position: nextPosition, dragging: nextDragging } as T;
    });
    return mutated ? next : current;
  }

  return {
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
        if (isLocalPositionSync) {
          return;
        }
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
        if (internal.tablesObserver) {
          tablesMap.unobserveDeep(internal.tablesObserver);
        }
        if (internal.edgesObserver) {
          edgesMap.unobserveDeep(internal.edgesObserver);
        }
        if (internal.groupsObserver) {
          groupsMap.unobserveDeep(internal.groupsObserver);
        }
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
        codeEditingTableKey: null,
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
          if (change.dragging === true) {
            internal.isNodeDragging = true;
          } else if (change.dragging === false) {
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
            fastNodes ?? (applyNodeChanges(tableChanges, currentNodes) as CanvasState['nodes']),
        });
      }

      if (groupChanges.length > 0) {
        const currentGroupNodes = get().groupNodes;
        const fastGroupNodes = applyPositionChangesFast(currentGroupNodes, groupChanges);
        set({
          groupNodes:
            fastGroupNodes ??
            (applyNodeChanges(groupChanges, currentGroupNodes) as CanvasState['groupNodes']),
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
      return hash === lastBackupHash ? null : { content, hash };
    },

    setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),
    setHighlightedEdge: (id) => set({ highlightedEdgeId: id }),
    clearHighlights: () => set({ highlightedNodeIds: [], highlightedEdgeId: null }),

    removeEdge: (edgeId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      getEdgesMap(ydoc).delete(edgeId);
      set({ highlightedEdgeId: null, highlightedNodeIds: [] });
    },

    removeEdgeWithFkColumn: (edgeId) => {
      const { ydoc, edges } = get();
      if (!ydoc) {
        return;
      }
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) {
        return;
      }

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
      if (!ydoc) {
        return;
      }
      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        for (const node of nodes) {
          const tableYMap = tablesMap.get(node.id);
          if (!tableYMap) {
            continue;
          }
          const posYMap = tableYMap.get('position') as Y.Map<number> | undefined;
          if (posYMap) {
            posYMap.set('x', node.position.x);
            posYMap.set('y', node.position.y);
          }
        }
      });
    },

    serialize: () => {
      const { ydoc } = get();
      return ydoc ? yDocToJson(ydoc) : JSON.stringify({ nodes: [], edges: [], groups: [] });
    },
  };
}
