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
import { normalizeEdgeHandlesInYDoc, syncEdgeHandlePreference } from '@/lib/erd-edge-yjs-utils';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import type { ERDEdgeData, TableGroup, TableNode, TableNodeData } from '@/types/erd';
import type { DslPreviewNode } from '@/lib/dsl-preview-graph';
import {
  deleteColumnFromYArray,
  createWaypointsYArray,
  getEdgesMap,
  getGroupsMap,
  yEdgeYMapToEdge,
  yGroupYMapToTableGroup,
  yTableYMapToNode,
  setTableYMapPosition,
  getTablesMap,
  yDocToJson,
  yEdgesMapToEdges,
  yGroupsMapToTableGroups,
  yTablesMapToNodes,
} from '@/collaboration/yjsBridge';
import { collectErdAffectedScopesFromEvents } from '@/collaboration/plugins/erd/erd-yjs-update-scope-collector';
import { buildErdProjectionRefreshRequest } from '@/collaboration/plugins/erd/erd-projection-refresh-request';
import type { EdgeRoutingType, Waypoint } from '@/types/erd';
import { buildPersistedPreviewPositionChanges } from '@/lib/preview-position-sync';
import {
  parseEdgeHandleSelectionValue,
  resolveEdgeHandlesFromPreference,
} from '@/lib/edge-handles';
import { isProjectorManagedDocumentOrigin } from '@/collaboration/core/store/document-change-origin';
import type {
  CanvasGetState,
  ProjectionSyncRequest,
  ProjectionSyncTarget,
  CanvasSetState,
  CanvasState,
  PositionQueueCtx,
} from './canvasStoreTypes';

type CanvasSyncActionKeys =
  | 'initYDoc'
  | 'destroyYDoc'
  | 'syncFromYDoc'
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
  function collectProjectionTargets(request?: ProjectionSyncRequest): Set<ProjectionSyncTarget> {
    const targets = new Set<ProjectionSyncTarget>(request?.targets ?? []);
    if ((request?.nodeIds?.length ?? 0) > 0) {
      targets.add('nodes');
    }
    if ((request?.edgeIds?.length ?? 0) > 0) {
      targets.add('edges');
    }
    if ((request?.groupIds?.length ?? 0) > 0) {
      targets.add('groups');
    }
    return targets;
  }

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
      if (change.type === 'position' && 'position' in change && isFinitePosition(change.position)) {
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

  function syncProjectionFromYDocWithRequest(request?: ProjectionSyncRequest): void {
    const ydoc = get().ydoc;
    if (!ydoc) {
      return;
    }

    const forceFull = request?.forceFull ?? false;
    const targets = forceFull ? new Set<ProjectionSyncTarget>() : collectProjectionTargets(request);

    if (forceFull || targets.size === 0) {
      const nextNodes = yTablesMapToNodes(getTablesMap(ydoc));
      const nextEdges = yEdgesMapToEdges(getEdgesMap(ydoc));
      const nextGroups = yGroupsMapToTableGroups(getGroupsMap(ydoc));
      set({
        nodes: nextNodes,
        edges: nextEdges,
        groups: nextGroups,
      });
      return;
    }

    const nextState: Partial<CanvasState> = {};
    const requestedNodeIds = new Set(request?.nodeIds ?? []);
    const requestedEdgeIds = new Set(request?.edgeIds ?? []);
    const requestedGroupIds = new Set(request?.groupIds ?? []);

    function mergeEntitiesById<T extends { id: string }>(
      current: T[],
      requestedIds: Set<string>,
      nextEntries: T[],
    ): T[] {
      if (requestedIds.size === 0) {
        return current;
      }
      const retained = current.filter((entry) => !requestedIds.has(entry.id));
      return [...retained, ...nextEntries];
    }

    if (targets.has('nodes')) {
      if (requestedNodeIds.size === 0) {
        nextState.nodes = yTablesMapToNodes(getTablesMap(ydoc));
      } else {
        const tablesMap = getTablesMap(ydoc);
        const nextNodes = [...requestedNodeIds]
          .map((nodeId) => {
            const tableYMap = tablesMap.get(nodeId);
            return tableYMap ? yTableYMapToNode(nodeId, tableYMap) : null;
          })
          .filter((node): node is Node<TableNodeData> => node != null);
        nextState.nodes = mergeEntitiesById(get().nodes as Node<TableNodeData>[], requestedNodeIds, nextNodes);
      }
    }
    if (targets.has('edges')) {
      if (requestedEdgeIds.size === 0) {
        nextState.edges = yEdgesMapToEdges(getEdgesMap(ydoc));
      } else {
        const edgesMap = getEdgesMap(ydoc);
        const nextEdges = [...requestedEdgeIds]
          .map((edgeId) => {
            const edgeYMap = edgesMap.get(edgeId);
            return edgeYMap ? yEdgeYMapToEdge(edgeId, edgeYMap) : null;
          })
          .filter((edge): edge is Edge<ERDEdgeData> => edge != null);
        nextState.edges = mergeEntitiesById(get().edges as Edge<ERDEdgeData>[], requestedEdgeIds, nextEdges);
      }
    }
    if (targets.has('groups')) {
      if (requestedGroupIds.size === 0) {
        nextState.groups = yGroupsMapToTableGroups(getGroupsMap(ydoc));
      } else {
        const groupsMap = getGroupsMap(ydoc);
        const nextGroups = [...requestedGroupIds]
          .map((groupId) => {
            const groupYMap = groupsMap.get(groupId);
            return groupYMap ? yGroupYMapToTableGroup(groupId, groupYMap) : null;
          })
          .filter((group): group is TableGroup => group != null);
        nextState.groups = mergeEntitiesById(get().groups, requestedGroupIds, nextGroups);
      }
    }
    set(nextState);
  }

  function collectObservedEntityIds(events: Y.YEvent<Y.AbstractType<unknown>>[]): string[] | null {
    const ids = new Set<string>();

    for (const event of events) {
      const scopedId = event.path[0];
      if (typeof scopedId === 'string' && scopedId.length > 0) {
        ids.add(scopedId);
        continue;
      }

      if (event.target instanceof Y.Map) {
        for (const [key] of event.changes.keys) {
          ids.add(String(key));
        }
        continue;
      }

      return null;
    }

    return ids.size > 0 ? [...ids] : null;
  }

  function queueDeferredProjectionSync(request?: ProjectionSyncRequest): void {
    const internal = get().internal;
    if (request?.forceFull) {
      internal.deferredProjectionForceFull = true;
      internal.hasDeferredProjectionSync = true;
      internal.deferredProjectionTargets.clear();
      internal.deferredProjectionNodeIds.clear();
      internal.deferredProjectionEdgeIds.clear();
      internal.deferredProjectionGroupIds.clear();
      return;
    }

    const targets = [...collectProjectionTargets(request)];
    if (targets.length === 0) {
      internal.deferredProjectionForceFull = true;
      internal.hasDeferredProjectionSync = true;
      internal.deferredProjectionTargets.clear();
      internal.deferredProjectionNodeIds.clear();
      internal.deferredProjectionEdgeIds.clear();
      internal.deferredProjectionGroupIds.clear();
      return;
    }

    internal.hasDeferredProjectionSync = true;
    for (const target of targets) {
      internal.deferredProjectionTargets.add(target);
    }
    for (const nodeId of request?.nodeIds ?? []) {
      internal.deferredProjectionNodeIds.add(nodeId);
    }
    for (const edgeId of request?.edgeIds ?? []) {
      internal.deferredProjectionEdgeIds.add(edgeId);
    }
    for (const groupId of request?.groupIds ?? []) {
      internal.deferredProjectionGroupIds.add(groupId);
    }
  }

  function flushDeferredProjectionSync(): void {
    const internal = get().internal;
    if (!internal.hasDeferredProjectionSync) {
      return;
    }

    const request: ProjectionSyncRequest = internal.deferredProjectionForceFull
      ? { forceFull: true }
      : {
          targets: [...internal.deferredProjectionTargets],
          nodeIds: [...internal.deferredProjectionNodeIds],
          edgeIds: [...internal.deferredProjectionEdgeIds],
          groupIds: [...internal.deferredProjectionGroupIds],
        };
    internal.hasDeferredProjectionSync = false;
    internal.deferredProjectionForceFull = false;
    internal.deferredProjectionTargets.clear();
    internal.deferredProjectionNodeIds.clear();
    internal.deferredProjectionEdgeIds.clear();
    internal.deferredProjectionGroupIds.clear();
    syncProjectionFromYDocWithRequest(request);
  }

  function shouldDeferProjectionToProjector(events: Y.YEvent<Y.AbstractType<unknown>>[]): boolean {
    return (
      events.length > 0 &&
      events.every((event) => {
        return isProjectorManagedDocumentOrigin(event.transaction.origin);
      })
    );
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
        if (shouldDeferProjectionToProjector(events)) {
          return;
        }
        const nodeIds = collectObservedEntityIds(events);
        const scopedRequest = nodeIds
          ? null
          : buildErdProjectionRefreshRequest(
              { scopeHints: collectErdAffectedScopesFromEvents(ydoc, events) },
              {
                allowedTargets: ['nodes'],
                fallbackTarget: 'nodes',
              },
            );
        if (get().internal.isNodeDragging) {
          queueDeferredProjectionSync(
            nodeIds
              ? { targets: ['nodes'], nodeIds }
              : (scopedRequest ?? { targets: ['nodes'] }),
          );
          return;
        }
        if (nodeIds) {
          syncProjectionFromYDocWithRequest({ targets: ['nodes'], nodeIds });
          return;
        }
        if (scopedRequest) {
          syncProjectionFromYDocWithRequest(scopedRequest);
          return;
        }
        set({ nodes: yTablesMapToNodes(tablesMap) });
      };
      internal.edgesObserver = (events) => {
        if (shouldDeferProjectionToProjector(events)) {
          return;
        }
        const edgeIds = collectObservedEntityIds(events);
        const scopedRequest = edgeIds
          ? null
          : buildErdProjectionRefreshRequest(
              { scopeHints: collectErdAffectedScopesFromEvents(ydoc, events) },
              {
                allowedTargets: ['edges'],
                fallbackTarget: 'edges',
              },
            );
        if (edgeIds) {
          syncProjectionFromYDocWithRequest({ targets: ['edges'], edgeIds });
          return;
        }
        if (scopedRequest) {
          syncProjectionFromYDocWithRequest(scopedRequest);
          return;
        }
        set({ edges: yEdgesMapToEdges(edgesMap) });
      };
      internal.groupsObserver = (events) => {
        if (shouldDeferProjectionToProjector(events)) {
          return;
        }
        const groupIds = collectObservedEntityIds(events);
        const scopedRequest = groupIds
          ? null
          : buildErdProjectionRefreshRequest(
              { scopeHints: collectErdAffectedScopesFromEvents(ydoc, events) },
              {
                allowedTargets: ['groups'],
                fallbackTarget: 'groups',
              },
            );
        if (groupIds) {
          syncProjectionFromYDocWithRequest({ targets: ['groups'], groupIds });
          return;
        }
        if (scopedRequest) {
          syncProjectionFromYDocWithRequest(scopedRequest);
          return;
        }
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
      internal.hasDeferredProjectionSync = false;
      internal.deferredProjectionForceFull = false;
      internal.deferredProjectionTargets.clear();
      internal.deferredProjectionNodeIds.clear();
      internal.deferredProjectionEdgeIds.clear();
      internal.deferredProjectionGroupIds.clear();

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

    syncFromYDoc: (request) => {
      if (get().internal.isNodeDragging) {
        queueDeferredProjectionSync(request);
        return;
      }
      syncProjectionFromYDocWithRequest(request);
    },

    onNodesChange: (changes) => {
      const internal = get().internal;
      const hasPositionChanges = changes.some((change) => change.type === 'position');

      let shouldFlushDeferredProjection = false;
      for (const change of changes) {
        if (change.type === 'position' && 'dragging' in change) {
          if (change.dragging === true) {
            internal.isNodeDragging = true;
          } else if (change.dragging === false) {
            internal.isNodeDragging = false;
            if (internal.hasDeferredProjectionSync) {
              shouldFlushDeferredProjection = true;
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
      if (shouldFlushDeferredProjection) {
        flushDeferredProjectionSync();
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
      const routingType = ((edge.data as ERDEdgeData | undefined)?.routingType ??
        'smoothstep') as EdgeRoutingType;
      const handlesChanged =
        edge.sourceHandle !== resolution.sourceHandle ||
        edge.targetHandle !== resolution.targetHandle;

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

    normalizeEdgeHandles: (nodeIds, _nodeOverrides, origin = CANVAS_HISTORY_ORIGIN.USER_EDGE) => {
      const { ydoc, edges } = get();
      if (!ydoc || edges.length === 0) {
        return;
      }

      ydoc.transact(() => {
        const mutated = normalizeEdgeHandlesInYDoc({ doc: ydoc, nodeIds });
        if (mutated) {
          get().internal.undoManager?.stopCapturing();
        }
      }, origin);
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
      flushDeferredProjectionSync();
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
