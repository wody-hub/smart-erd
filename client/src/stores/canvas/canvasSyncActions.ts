import * as Y from 'yjs';
import {
  type Edge,
  type Node,
  type NodeChange,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import {
  CANVAS_HISTORY_ORIGIN,
  createTrackedCanvasHistoryOrigins,
  DRAG_TRANSACTION_ORIGIN,
  UNDO_CAPTURE_TIMEOUT_MS,
} from '@/constants/canvas-history';
import { djb2 } from '@/lib/hash';
import { extractColId } from '@/lib/handle-id';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import type { ERDEdgeData, TableGroup, TableNode, TableNodeData } from '@/types/erd';
import type { DslPreviewNode } from '@/lib/dsl-preview-graph';
import {
  deleteColumnFromYArray,
  createWaypointsYArray,
  getEdgesMap,
  getGroupsMap,
  setTableYMapPosition,
  getTablesMap,
  yDocToJson,
  yEdgesMapToEdges,
  yGroupsMapToTableGroups,
  yTablesMapToNodes,
} from '@/collaboration/yjsBridge';
import type { EdgeRoutingType, Waypoint } from '@/types/erd';
import { buildPersistedPreviewPositionChanges } from '@/lib/preview-position-sync';
import {
  parseEdgeHandleSelectionValue,
  resolveEdgeHandlesFromPreference,
} from '@/lib/edge-handles';
import type {
  CanvasGetState,
  CanvasSetState,
  CanvasState,
  PositionQueueCtx,
} from './canvasStoreTypes';

type CanvasSyncActionKeys =
  | 'initYDoc'
  | 'destroyYDoc'
  | 'loadPreview'
  | 'onNodesChange'
  | 'onEdgesChange'
  | 'setNodes'
  | 'setEdges'
  | 'markBackedUp'
  | 'prepareBackup'
  | 'setHighlightedNodes'
  | 'setHighlightedEdge'
  | 'clearHighlights'
  | 'undo'
  | 'redo'
  | 'stopHistoryCapture'
  | 'removeEdge'
  | 'removeEdgeWithFkColumn'
  | 'updateEdgeRoutingType'
  | 'updateEdgeHandleSelection'
  | 'updateEdgeWaypoints'
  | 'resetEdgeWaypoints'
  | 'normalizeEdgeHandles'
  | 'applyLayout'
  | 'finalizeNodeDrag'
  | 'applyPreviewPositionChangesToPersisted'
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
  function isFinitePosition(
    position: { x: number; y: number } | null | undefined,
  ): position is { x: number; y: number } {
    return !!position && Number.isFinite(position.x) && Number.isFinite(position.y);
  }

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
      if (
        change.type === 'position' &&
        'position' in change &&
        isFinitePosition(change.position)
      ) {
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
        if (!isFinitePosition(pos)) {
          continue;
        }
        const nodeYMap = yMap.get(nodeId);
        if (!nodeYMap) {
          continue;
        }
        setTableYMapPosition(nodeYMap, pos);
      }
    }, DRAG_TRANSACTION_ORIGIN);
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

  function buildNodeLookup(nodeOverrides?: Node<TableNodeData>[]) {
    const nodeById = new Map(get().nodes.map((node) => [node.id, node]));
    for (const node of nodeOverrides ?? []) {
      const existingNode = nodeById.get(node.id);
      nodeById.set(node.id, existingNode ? { ...existingNode, ...node } : node);
    }
    return nodeById;
  }

  function syncEdgeHandlePreference(
    edgeYMap: Y.Map<unknown>,
    resolution: {
      handleMode: 'auto' | 'manual';
      sourceSide: 'left' | 'right';
      targetSide: 'left' | 'right';
    },
  ) {
    if (resolution.handleMode === 'manual') {
      edgeYMap.set('handleMode', 'manual');
      edgeYMap.set('sourceSide', resolution.sourceSide);
      edgeYMap.set('targetSide', resolution.targetSide);
      return;
    }
    edgeYMap.delete('handleMode');
    edgeYMap.delete('sourceSide');
    edgeYMap.delete('targetSide');
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

      internal.undoManager = new Y.UndoManager([tablesMap, edgesMap, groupsMap], {
        trackedOrigins: createTrackedCanvasHistoryOrigins(),
        captureTimeout: UNDO_CAPTURE_TIMEOUT_MS,
      });

      /** undo/redo 버튼 활성 상태를 현재 스택 길이에 맞춰 동기화한다. @returns 없음 */
      const syncUndoState = () => {
        const undoManager = get().internal.undoManager;
        set({
          canUndo: !!undoManager && undoManager.undoStack.length > 0,
          canRedo: !!undoManager && undoManager.redoStack.length > 0,
        });
      };
      internal.undoManager.on('stack-item-added', syncUndoState);
      internal.undoManager.on('stack-item-popped', syncUndoState);
      internal.undoManager.on('stack-cleared', syncUndoState);
      syncUndoState();

      internal.tablesObserver = (events) => {
        const isLocalPositionSync =
          events.length > 0 &&
          events.every((event) => event.transaction.origin === DRAG_TRANSACTION_ORIGIN);
        if (isLocalPositionSync) {
          return;
        }
        if (get().internal.isNodeDragging) {
          get().internal.hasDeferredTableSync = true;
          return;
        }
        const nextNodes = yTablesMapToNodes(tablesMap);
        set({ nodes: nextNodes });
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

    loadPreview: (json: string) => {
      try {
        const parsed = JSON.parse(json) as {
          nodes?: Node<TableNodeData>[];
          edges?: Edge[];
          groups?: TableGroup[];
        };
        set({
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          edges: Array.isArray(parsed.edges)
            ? parsed.edges.map((e: Edge) => ({ ...e, type: e.type ?? 'erdRelation' }))
            : [],
          groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        });
      } catch {
        // JSON 파싱 실패 시 무시 — 빈 캔버스 유지
      }
    },

    destroyYDoc: () => {
      const { ydoc, internal } = get();
      if (ydoc) {
        internal.undoManager?.destroy();
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
      internal.undoManager = null;
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
        canUndo: false,
        canRedo: false,
      });
    },

    onNodesChange: (changes) => {
      const internal = get().internal;
      const hasPositionChanges = changes.some((change) => change.type === 'position');

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

      if (hasPositionChanges) {
        return;
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
    undo: () => {
      const undoManager = get().internal.undoManager;
      if (!undoManager || undoManager.undoStack.length === 0) {
        return;
      }
      undoManager.undo();
      set({
        activeEditNodeId: null,
        highlightedEdgeId: null,
        highlightedNodeIds: [],
        canUndo: undoManager.undoStack.length > 0,
        canRedo: undoManager.redoStack.length > 0,
      });
    },
    redo: () => {
      const undoManager = get().internal.undoManager;
      if (!undoManager || undoManager.redoStack.length === 0) {
        return;
      }
      undoManager.redo();
      set({
        activeEditNodeId: null,
        highlightedEdgeId: null,
        highlightedNodeIds: [],
        canUndo: undoManager.undoStack.length > 0,
        canRedo: undoManager.redoStack.length > 0,
      });
    },
    stopHistoryCapture: () => {
      get().internal.undoManager?.stopCapturing();
    },

    removeEdge: (edgeId) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      ydoc.transact(() => {
        getEdgesMap(ydoc).delete(edgeId);
      }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
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
      }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
      set({ highlightedEdgeId: null, highlightedNodeIds: [] });
    },

    updateEdgeRoutingType: (edgeId, routingType) => {
      const { ydoc } = get();
      if (!ydoc) {
        return;
      }
      ydoc.transact(() => {
        const edgeYMap = getEdgesMap(ydoc).get(edgeId);
        if (!edgeYMap) {
          return;
        }
        edgeYMap.set('routingType', routingType as EdgeRoutingType);
        if (routingType !== 'straight') {
          edgeYMap.delete('waypoints');
        }
      }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    },

    updateEdgeHandleSelection: (edgeId, selection, nodeOverrides) => {
      const { ydoc, edges } = get();
      if (!ydoc) {
        return;
      }
      const edge = edges.find((candidate) => candidate.id === edgeId);
      if (!edge?.sourceHandle || !edge.targetHandle) {
        return;
      }

      const nodeById = buildNodeLookup(nodeOverrides);
      const sourceNode = nodeById.get(edge.source);
      const targetNode = nodeById.get(edge.target);
      if (!sourceNode || !targetNode) {
        return;
      }

      const sourceColId = extractColId(edge.sourceHandle, edge.source);
      const targetColId = extractColId(edge.targetHandle, edge.target);
      const preference = parseEdgeHandleSelectionValue(selection);
      const resolution = resolveEdgeHandlesFromPreference({
        sourceNode,
        targetNode,
        sourceColId,
        targetColId,
        handleMode: preference.handleMode,
        sourceSide: preference.sourceSide,
        targetSide: preference.targetSide,
      });
      const routingType =
        ((edge.data as ERDEdgeData | undefined)?.routingType ?? 'smoothstep') as EdgeRoutingType;
      const handlesChanged =
        edge.sourceHandle !== resolution.sourceHandle || edge.targetHandle !== resolution.targetHandle;

      ydoc.transact(() => {
        const edgeYMap = getEdgesMap(ydoc).get(edgeId);
        if (!edgeYMap) {
          return;
        }
        edgeYMap.set('sourceHandle', resolution.sourceHandle);
        edgeYMap.set('targetHandle', resolution.targetHandle);
        syncEdgeHandlePreference(edgeYMap, resolution);
        if (routingType === 'straight' && handlesChanged) {
          edgeYMap.delete('waypoints');
        }
      }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    },

    updateEdgeWaypoints: (edgeId, waypoints) => {
      const { ydoc, internal } = get();
      if (!ydoc) {
        return;
      }
      internal.undoManager?.stopCapturing();
      ydoc.transact(() => {
        const edgeYMap = getEdgesMap(ydoc).get(edgeId);
        if (!edgeYMap) {
          return;
        }
        const nextWaypoints = waypoints.filter(
          (waypoint): waypoint is Waypoint =>
            Number.isFinite(waypoint.x) && Number.isFinite(waypoint.y),
        );
        if (nextWaypoints.length === 0) {
          edgeYMap.delete('waypoints');
          return;
        }
        edgeYMap.set('waypoints', createWaypointsYArray(nextWaypoints));
      }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
      internal.undoManager?.stopCapturing();
    },

    resetEdgeWaypoints: (edgeId) => {
      const { ydoc, internal } = get();
      if (!ydoc) {
        return;
      }
      internal.undoManager?.stopCapturing();
      ydoc.transact(() => {
        const edgeYMap = getEdgesMap(ydoc).get(edgeId);
        edgeYMap?.delete('waypoints');
      }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
      internal.undoManager?.stopCapturing();
    },

    normalizeEdgeHandles: (nodeIds, nodeOverrides, origin = CANVAS_HISTORY_ORIGIN.USER_EDGE) => {
      const { ydoc, edges } = get();
      if (!ydoc || edges.length === 0) {
        return;
      }

      const filterIds = nodeIds ? new Set(nodeIds) : null;
      const nodeById = buildNodeLookup(nodeOverrides);
      let mutated = false;

      ydoc.transact(() => {
        const edgesMap = getEdgesMap(ydoc);
        for (const edge of edges) {
          if (
            filterIds &&
            !filterIds.has(edge.source) &&
            !filterIds.has(edge.target)
          ) {
            continue;
          }
          if (!edge.sourceHandle || !edge.targetHandle) {
            continue;
          }

          const sourceNode = nodeById.get(edge.source);
          const targetNode = nodeById.get(edge.target);
          if (!sourceNode || !targetNode) {
            continue;
          }

          const sourceColId = extractColId(edge.sourceHandle, edge.source);
          const targetColId = extractColId(edge.targetHandle, edge.target);
          const edgeData = (edge.data as ERDEdgeData | undefined) ?? undefined;
          const resolution = resolveEdgeHandlesFromPreference({
            sourceNode,
            targetNode,
            sourceColId,
            targetColId,
            handleMode: edgeData?.handleMode,
            sourceSide: edgeData?.sourceSide,
            targetSide: edgeData?.targetSide,
          });
          const { sourceHandle, targetHandle } = resolution;

          const handlesChanged =
            sourceHandle !== edge.sourceHandle || targetHandle !== edge.targetHandle;
          const manualChanged =
            resolution.handleMode === 'manual'
              ? edgeData?.handleMode !== 'manual' ||
                edgeData?.sourceSide !== resolution.sourceSide ||
                edgeData?.targetSide !== resolution.targetSide
              : edgeData?.handleMode === 'manual' ||
                edgeData?.sourceSide !== undefined ||
                edgeData?.targetSide !== undefined;

          if (!handlesChanged && !manualChanged) {
            continue;
          }

          const edgeYMap = edgesMap.get(edge.id);
          if (!edgeYMap) {
            continue;
          }

          edgeYMap.set('sourceHandle', sourceHandle);
          edgeYMap.set('targetHandle', targetHandle);
          syncEdgeHandlePreference(edgeYMap, resolution);
          const routingType =
            (edgeYMap.get('routingType') as EdgeRoutingType | undefined) ?? 'smoothstep';
          if (routingType === 'straight' && handlesChanged) {
            edgeYMap.delete('waypoints');
          }
          mutated = true;
        }
      }, origin);

      if (mutated) {
        get().internal.undoManager?.stopCapturing();
      }
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
          setTableYMapPosition(tableYMap, node.position);
        }
      }, CANVAS_HISTORY_ORIGIN.USER_LAYOUT);
    },

    finalizeNodeDrag: (nodePositions) => {
      const internal = get().internal;
      for (const entry of nodePositions ?? []) {
        if (!isFinitePosition(entry.position)) {
          continue;
        }
        internal.tablePositionQueue.pending.set(entry.nodeId, entry.position);
      }
      internal.isNodeDragging = false;
      flushQueuedPositionsToYDoc(internal.tablePositionQueue, getTablesMap);
      if (internal.hasDeferredTableSync) {
        internal.hasDeferredTableSync = false;
        const doc = get().ydoc;
        if (doc) {
          set({ nodes: yTablesMapToNodes(getTablesMap(doc)) });
        }
      }
    },

    applyPreviewPositionChangesToPersisted: (
      previewNodes: readonly DslPreviewNode[],
      positionOverrides: DiagramPreviewPositionRecord,
    ) => {
      const { ydoc, nodes } = get();
      const persistedPositionChanges = buildPersistedPreviewPositionChanges(
        previewNodes,
        nodes as TableNode[],
        positionOverrides,
      );
      if (persistedPositionChanges.length === 0) {
        return [];
      }

      if (!ydoc) {
        const reactFlowPositionChanges: NodeChange[] = persistedPositionChanges.map((change) => ({
          id: change.nodeId,
          type: 'position',
          position: change.position,
          dragging: false,
        }));
        get().onNodesChange(reactFlowPositionChanges);
        return persistedPositionChanges.map((change) => change.previewNodeId);
      }

      ydoc.transact(() => {
        const tablesMap = getTablesMap(ydoc);
        for (const change of persistedPositionChanges) {
          if (!isFinitePosition(change.position)) {
            continue;
          }
          const tableYMap = tablesMap.get(change.nodeId);
          if (!tableYMap) {
            continue;
          }
          setTableYMapPosition(tableYMap, change.position);
        }
      }, DRAG_TRANSACTION_ORIGIN);
      set({ nodes: yTablesMapToNodes(getTablesMap(ydoc)) });
      return persistedPositionChanges.map((change) => change.previewNodeId);
    },

    serialize: () => {
      const { ydoc } = get();
      return ydoc ? yDocToJson(ydoc) : JSON.stringify({ nodes: [], edges: [], groups: [] });
    },
  };
}
