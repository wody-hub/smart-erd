import { useMemo } from 'react';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import { resolveDiagramDocumentStatus } from '@/collaboration/channel/diagram/diagram-session-action-utils';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';
import useCanvasStore from '@/stores/erd/useCanvasStore';

export interface DiagramErdDragActions {
  commitTableDrag: (nodeId: string, position: { x: number; y: number }) => void;
}

export function useDiagramErdDragActions(): DiagramErdDragActions {
  const erdDocumentActions = useErdDocumentActions();
  const notifyRejected = useDiagramRejectedCommandToast();
  const finalizeNodeDrag = useCanvasStore((state) => state.finalizeNodeDrag);
  const stopHistoryCapture = useCanvasStore((state) => state.stopHistoryCapture);

  return useMemo(
    () => ({
      commitTableDrag: (nodeId: string, position: { x: number; y: number }) => {
        resolveDiagramDocumentStatus(
          erdDocumentActions.moveTable(nodeId, position.x, position.y),
          notifyRejected,
        );
        // 성공 여부와 무관하게 임시 위치를 버리고 확정된 문서 위치를 다시 투영한다.
        finalizeNodeDrag();
        stopHistoryCapture();
      },
    }),
    [erdDocumentActions, finalizeNodeDrag, notifyRejected, stopHistoryCapture],
  );
}
