import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import type { EdgeHandleNormalizationReason } from '@/collaboration/plugins/erd/erd-document-plugin';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { AddFkRelationParams } from '@/stores/canvas/canvasStoreTypes';
import { resolveDiagramAppliedStatus } from '@/collaboration/channel/diagram/diagram-session-action-utils';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';
import type { EdgeRoutingType, RelationType, TableNodeData, Waypoint } from '@/types/erd';
import type { EdgeHandleSelectionValue } from '@/lib/edge-handles';

type AppliedStatus = 'applied' | 'rejected';

interface NormalizeEdgeHandlesFallback {
  nodeOverrides?: Node<TableNodeData>[];
  origin?: unknown;
}

export interface DiagramErdEdgeActions {
  connectEdge: (
    sourceTableId: string,
    targetTableId: string,
    sourceHandle: string,
    targetHandle: string,
    relationType: RelationType,
  ) => AppliedStatus;
  addFkRelation: (params: AddFkRelationParams) => number;
  deleteEdge: (edgeId: string, removeFkColumn?: boolean) => AppliedStatus;
  updateEdgeRoutingType: (edgeId: string, routingType: EdgeRoutingType) => AppliedStatus;
  updateEdgeHandleSelection: (
    edgeId: string,
    selection: EdgeHandleSelectionValue,
    nodeOverrides?: Node<TableNodeData>[],
  ) => AppliedStatus;
  updateEdgeWaypoints: (edgeId: string, waypoints: Waypoint[]) => AppliedStatus;
  resetEdgeWaypoints: (edgeId: string) => AppliedStatus;
  normalizeEdgeHandles: (
    nodeIds?: string[],
    reason?: EdgeHandleNormalizationReason,
    fallback?: NormalizeEdgeHandlesFallback,
  ) => AppliedStatus;
}

export function useDiagramErdEdgeActions(): DiagramErdEdgeActions {
  const erdDocumentActions = useErdDocumentActions();
  const addFkRelationFallback = useCanvasStore((s) => s.addFkRelation);
  const connectWithRelationTypeFallback = useCanvasStore((s) => s.connectWithRelationType);
  const removeEdgeFallback = useCanvasStore((s) => s.removeEdge);
  const removeEdgeWithFkColumnFallback = useCanvasStore((s) => s.removeEdgeWithFkColumn);
  const updateEdgeRoutingTypeFallback = useCanvasStore((s) => s.updateEdgeRoutingType);
  const updateEdgeHandleSelectionFallback = useCanvasStore((s) => s.updateEdgeHandleSelection);
  const updateEdgeWaypointsFallback = useCanvasStore((s) => s.updateEdgeWaypoints);
  const resetEdgeWaypointsFallback = useCanvasStore((s) => s.resetEdgeWaypoints);
  const normalizeEdgeHandlesFallback = useCanvasStore((s) => s.normalizeEdgeHandles);
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
      connectEdge: (
        sourceTableId: string,
        targetTableId: string,
        sourceHandle: string,
        targetHandle: string,
        relationType: RelationType,
      ) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.connectEdge(
            sourceTableId,
            targetTableId,
            sourceHandle,
            targetHandle,
            relationType,
          ),
          () =>
            connectWithRelationTypeFallback(
              sourceTableId,
              targetTableId,
              sourceHandle || undefined,
              targetHandle || undefined,
              relationType,
            ),
          notifyRejected,
        );
      },
      addFkRelation: (params: AddFkRelationParams) => {
        const result = erdDocumentActions.addFkRelation(
          params.parentNodeId,
          params.childNodeId,
          params.relationType,
        );
        if (result === 'unavailable') {
          return addFkRelationFallback(params);
        }
        if (result === 'rejected') {
          notifyRejected();
        }
        return result === 'applied' ? params.pkColumns.length : 0;
      },
      deleteEdge: (edgeId: string, removeFkColumn = false) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.deleteEdge(edgeId, removeFkColumn),
          () => {
            if (removeFkColumn) {
              removeEdgeWithFkColumnFallback(edgeId);
              return;
            }
            removeEdgeFallback(edgeId);
          },
          notifyRejected,
        );
      },
      updateEdgeRoutingType: (edgeId: string, routingType: EdgeRoutingType) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.updateEdgeRoutingType(edgeId, routingType),
          () => updateEdgeRoutingTypeFallback(edgeId, routingType),
          notifyRejected,
        );
      },
      updateEdgeHandleSelection: (
        edgeId: string,
        selection: EdgeHandleSelectionValue,
        nodeOverrides?: Node<TableNodeData>[],
      ) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.updateEdgeHandleSelection(edgeId, selection),
          () => updateEdgeHandleSelectionFallback(edgeId, selection, nodeOverrides),
          notifyRejected,
        );
      },
      updateEdgeWaypoints: (edgeId: string, waypoints: Waypoint[]) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.updateEdgeWaypoints(edgeId, waypoints),
          () => updateEdgeWaypointsFallback(edgeId, waypoints),
          notifyRejected,
        );
      },
      resetEdgeWaypoints: (edgeId: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.resetEdgeWaypoints(edgeId),
          () => resetEdgeWaypointsFallback(edgeId),
          notifyRejected,
        );
      },
      normalizeEdgeHandles: (
        nodeIds?: string[],
        reason?: EdgeHandleNormalizationReason,
        fallback?: NormalizeEdgeHandlesFallback,
      ) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.normalizeEdgeHandles(nodeIds, reason),
          () => normalizeEdgeHandlesFallback(nodeIds, fallback?.nodeOverrides, fallback?.origin),
          notifyRejected,
        );
      },
    }),
    [
      addFkRelationFallback,
      connectWithRelationTypeFallback,
      erdDocumentActions,
      normalizeEdgeHandlesFallback,
      notifyRejected,
      removeEdgeFallback,
      removeEdgeWithFkColumnFallback,
      resetEdgeWaypointsFallback,
      updateEdgeHandleSelectionFallback,
      updateEdgeRoutingTypeFallback,
      updateEdgeWaypointsFallback,
    ],
  );
}
