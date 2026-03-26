import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import { DRAG_TRANSACTION_ORIGIN } from '@/constants/canvas-history';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import { useDiagramErdEdgeActions } from '@/collaboration/channel/diagram/use-diagram-erd-edge-actions';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { TableNodeData } from '@/types/erd';

export interface DiagramErdDragActions {
  commitTableDrag: (
    nodeId: string,
    position: { x: number; y: number },
    normalizedNode?: Node<TableNodeData>,
  ) => void;
}

export function useDiagramErdDragActions(): DiagramErdDragActions {
  const erdDocumentActions = useErdDocumentActions();
  const edgeActions = useDiagramErdEdgeActions();
  const finalizeNodeDrag = useCanvasStore((state) => state.finalizeNodeDrag);
  const stopHistoryCapture = useCanvasStore((state) => state.stopHistoryCapture);

  return useMemo(
    () => ({
      commitTableDrag: (
        nodeId: string,
        position: { x: number; y: number },
        normalizedNode?: Node<TableNodeData>,
      ) => {
        const moveResult = erdDocumentActions.moveTable(nodeId, position.x, position.y);
        finalizeNodeDrag(
          moveResult !== 'unavailable'
            ? undefined
            : [
                {
                  nodeId,
                  position,
                },
              ],
        );
        edgeActions.normalizeEdgeHandles([nodeId], 'table-move', {
          nodeOverrides: normalizedNode ? [normalizedNode] : undefined,
          origin: DRAG_TRANSACTION_ORIGIN,
        });
        stopHistoryCapture();
      },
    }),
    [edgeActions, erdDocumentActions, finalizeNodeDrag, stopHistoryCapture],
  );
}
