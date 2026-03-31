import { useMemo } from 'react';
import type { DslPreviewNode } from '@/lib/dsl-preview-graph';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import {
  buildPersistedPreviewPositionChanges,
  matchPreviewNodesToPersistedNodes,
} from '@/lib/preview-position-sync';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';
import { useDiagramCollaborationStoreBridge } from '@/collaboration/channel/diagram/use-diagram-collaboration-store-bridge';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import type { TableNode } from '@/types/erd';

export interface DiagramPreviewPositionActions {
  syncMatchedPreviewNodePosition: (
    previewNode: DslPreviewNode,
    persistedNodes: readonly TableNode[],
  ) => boolean;
  syncPreviewPositionOverridesToPersisted: (
    previewNodes: readonly DslPreviewNode[],
    positionOverrides: DiagramPreviewPositionRecord,
    persistedNodes: readonly TableNode[],
  ) => string[];
}

function pickRemainingPreviewPositionOverrides(
  previewNodes: readonly DslPreviewNode[],
  positionOverrides: DiagramPreviewPositionRecord,
  remainingPreviewNodeIds: Set<string>,
): {
  remainingPreviewNodes: DslPreviewNode[];
  remainingPositionOverrides: DiagramPreviewPositionRecord;
} {
  const remainingPreviewNodes = previewNodes.filter((previewNode) =>
    remainingPreviewNodeIds.has(previewNode.id),
  );
  const remainingPositionOverrides = Object.fromEntries(
    Object.entries(positionOverrides).filter(([previewNodeId]) => remainingPreviewNodeIds.has(previewNodeId)),
  );
  return {
    remainingPreviewNodes,
    remainingPositionOverrides,
  };
}

export function useDiagramPreviewPositionActions(): DiagramPreviewPositionActions {
  const erdDocumentActions = useErdDocumentActions();
  const storeBridge = useDiagramCollaborationStoreBridge();
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
      syncMatchedPreviewNodePosition: (
        previewNode: DslPreviewNode,
        persistedNodes: readonly TableNode[],
      ) => {
        const matchedPersistedNode = matchPreviewNodesToPersistedNodes(
          [previewNode],
          persistedNodes,
        ).get(previewNode.id);
        if (!matchedPersistedNode) {
          return false;
        }

        const result = erdDocumentActions.moveTable(
          matchedPersistedNode.id,
          previewNode.position.x,
          previewNode.position.y,
        );
        if (result === 'unavailable') {
          const syncedPreviewNodeIds = storeBridge.applyPreviewPositionChangesToPersisted(
            [previewNode],
            {
              [previewNode.id]: previewNode.position,
            },
          );
          return syncedPreviewNodeIds.includes(previewNode.id);
        }
        if (result === 'rejected') {
          notifyRejected();
          return false;
        }
        return true;
      },
      syncPreviewPositionOverridesToPersisted: (
        previewNodes: readonly DslPreviewNode[],
        positionOverrides: DiagramPreviewPositionRecord,
        persistedNodes: readonly TableNode[],
      ) => {
        const persistedPositionChanges = buildPersistedPreviewPositionChanges(
          previewNodes,
          persistedNodes,
          positionOverrides,
        );
        if (persistedPositionChanges.length === 0) {
          return [];
        }

        if (!erdDocumentActions.available) {
          return storeBridge.applyPreviewPositionChangesToPersisted(
            previewNodes,
            positionOverrides,
          );
        }

        const syncedPreviewNodeIds: string[] = [];
        for (let index = 0; index < persistedPositionChanges.length; index += 1) {
          const change = persistedPositionChanges[index];
          const result = erdDocumentActions.moveTable(
            change.nodeId,
            change.position.x,
            change.position.y,
          );
          if (result === 'unavailable') {
            const remainingPreviewNodeIds = new Set(
              persistedPositionChanges.slice(index).map((remainingChange) => remainingChange.previewNodeId),
            );
            const { remainingPreviewNodes, remainingPositionOverrides } = pickRemainingPreviewPositionOverrides(
              previewNodes,
              positionOverrides,
              remainingPreviewNodeIds,
            );
            const fallbackSyncedPreviewNodeIds = storeBridge.applyPreviewPositionChangesToPersisted(
              remainingPreviewNodes,
              remainingPositionOverrides,
            );
            return [...syncedPreviewNodeIds, ...fallbackSyncedPreviewNodeIds];
          }
          if (result === 'rejected') {
            notifyRejected();
            return syncedPreviewNodeIds;
          }
          syncedPreviewNodeIds.push(change.previewNodeId);
        }
        return syncedPreviewNodeIds;
      },
    }),
    [erdDocumentActions, notifyRejected, storeBridge],
  );
}
