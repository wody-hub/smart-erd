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
  yGroupsMapToTableGroups,
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
 *
 * @param set Zustand set 함수
 * @param get Zustand get 함수
 * @returns 동기화/뷰 상태 액션 맵
 */
export function createCanvasSyncActions(
  set: CanvasSetState,
  get: CanvasGetState,
): Pick<CanvasState, CanvasSyncActionKeys> {
  const POSITION_SYNC_ORIGIN = 'local-position-sync';

  /**
   * 노드 position 변경을 대기 큐에 적재한다.
   *
   * @param changes React Flow 노드 변경 목록
   * @param ctx 위치 동기화 큐 컨텍스트
   * @returns 없음
   */
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

  /**
   * 큐에 쌓인 position 변경을 Y.Doc에 반영한다.
   *
   * @param ctx 위치 동기화 큐 컨텍스트
   * @param getYMap 대상 Y.Map getter
   * @returns 없음
   */
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

  /**
   * position-only 변경은 빠른 경로로 적용한다.
   *
   * @param current 현재 노드 목록
   * @param changes 적용할 변경 목록
   * @returns 빠른 적용 결과. 빠른 경로 미사용 시 null
   */
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
      const internal = get().internal;

      set({
        nodes: yTablesMapToNodes(tablesMap),
        edges: yEdgesMapToEdges(edgesMap),
        groups: yGroupsMapToTableGroups(groupsMap),
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
        set({ groups: yGroupsMapToTableGroups(groupsMap) });
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
      internal.isNodeDragging = false;
      internal.hasDeferredTableSync = false;

      set({
        ydoc: null,
        nodes: [],
        edges: [],
        groups: [],
        lastBackupHash: '',
        activeEditNodeId: null,
        codeEditingTableKey: null,
      });
    },

    onNodesChange: (changes) => {
      const internal = get().internal;

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

      if (changes.length > 0) {
        const currentNodes = get().nodes;
        const fastNodes = applyPositionChangesFast(currentNodes, changes);
        set({
          nodes: fastNodes ?? (applyNodeChanges(changes, currentNodes) as CanvasState['nodes']),
        });
      }

      queuePositionToYDoc(changes, internal.tablePositionQueue);
      if (!internal.isNodeDragging) {
        flushQueuedPositionsToYDoc(internal.tablePositionQueue, getTablesMap);
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
