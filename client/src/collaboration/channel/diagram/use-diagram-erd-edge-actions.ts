import { useMemo } from 'react';
import type { EdgeHandleNormalizationReason } from '@/collaboration/plugins/erd/erd-document-plugin';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import type { AddFkRelationParams } from '@/stores/canvas/canvasStoreTypes';
import { resolveDiagramDocumentStatus } from '@/collaboration/channel/diagram/diagram-session-action-utils';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';
import type { EdgeRoutingType, RelationType, Waypoint } from '@/types/erd';
import type { EdgeHandleSelectionValue } from '@/lib/edge-handles';

type AppliedStatus = 'applied' | 'rejected';

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
  updateEdgeHandleSelection: (edgeId: string, selection: EdgeHandleSelectionValue) => AppliedStatus;
  updateEdgeWaypoints: (edgeId: string, waypoints: Waypoint[]) => AppliedStatus;
  resetEdgeWaypoints: (edgeId: string) => AppliedStatus;
  normalizeEdgeHandles: (
    nodeIds?: string[],
    reason?: EdgeHandleNormalizationReason,
  ) => AppliedStatus;
}

export function useDiagramErdEdgeActions(): DiagramErdEdgeActions {
  const erdDocumentActions = useErdDocumentActions();
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
        return resolveDiagramDocumentStatus(
          erdDocumentActions.connectEdge(
            sourceTableId,
            targetTableId,
            sourceHandle,
            targetHandle,
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
        resolveDiagramDocumentStatus(result, notifyRejected);
        return result === 'applied' ? params.pkColumns.length : 0;
      },
      deleteEdge: (edgeId: string, removeFkColumn = false) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.deleteEdge(edgeId, removeFkColumn),
          notifyRejected,
        );
      },
      updateEdgeRoutingType: (edgeId: string, routingType: EdgeRoutingType) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.updateEdgeRoutingType(edgeId, routingType),
          notifyRejected,
        );
      },
      updateEdgeHandleSelection: (edgeId: string, selection: EdgeHandleSelectionValue) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.updateEdgeHandleSelection(edgeId, selection),
          notifyRejected,
        );
      },
      updateEdgeWaypoints: (edgeId: string, waypoints: Waypoint[]) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.updateEdgeWaypoints(edgeId, waypoints),
          notifyRejected,
        );
      },
      resetEdgeWaypoints: (edgeId: string) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.resetEdgeWaypoints(edgeId),
          notifyRejected,
        );
      },
      normalizeEdgeHandles: (nodeIds?: string[], reason?: EdgeHandleNormalizationReason) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.normalizeEdgeHandles(nodeIds, reason),
          notifyRejected,
        );
      },
    }),
    [erdDocumentActions, notifyRejected],
  );
}
