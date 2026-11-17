import { useMemo } from 'react';
import type { DslPreviewNode } from '@/lib/dsl-preview-graph';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import {
  commitPreviewPositionOverrides,
  type PreviewPositionCommitResult,
} from '@/lib/erd-preview-position-commit';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import type { TableNode } from '@/types/erd';

export interface DiagramPreviewPositionActions {
  syncMatchedPreviewNodePosition: (
    previewNode: DslPreviewNode,
    persistedNodes: readonly TableNode[],
    previewNodes: readonly DslPreviewNode[],
  ) => boolean;
  syncPreviewPositionOverridesToPersisted: (
    previewNodes: readonly DslPreviewNode[],
    positionOverrides: DiagramPreviewPositionRecord,
    persistedNodes: readonly TableNode[],
  ) => PreviewPositionCommitResult;
}

export function useDiagramPreviewPositionActions(): DiagramPreviewPositionActions {
  const erdDocumentActions = useErdDocumentActions();
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
      syncMatchedPreviewNodePosition: (previewNode, persistedNodes, previewNodes) => {
        const result = commitPreviewPositionOverrides(
          previewNodes,
          { [previewNode.id]: previewNode.position },
          persistedNodes,
          erdDocumentActions,
          notifyRejected,
        );
        return result.syncedPreviewNodeIds.includes(previewNode.id);
      },
      syncPreviewPositionOverridesToPersisted: (previewNodes, positionOverrides, persistedNodes) =>
        commitPreviewPositionOverrides(
          previewNodes,
          positionOverrides,
          persistedNodes,
          erdDocumentActions,
          notifyRejected,
        ),
    }),
    [erdDocumentActions, notifyRejected],
  );
}
