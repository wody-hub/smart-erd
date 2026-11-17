import type { DocumentCommandDispatchStatus } from '@/collaboration/core/session/document-mutation-session';
import type { PositionBatch } from '@/collaboration/plugins/erd/erd-position-batch';
import type { TableNode } from '@/types/erd';
import type { DiagramPreviewPositionRecord } from './diagram-code-draft';
import type { DslPreviewNode } from './dsl-preview-graph';
import { matchPreviewNodesToPersistedNodes } from './preview-position-sync';

export interface PreviewPositionBatchActions {
  available: boolean;
  applyPreviewPositions: (batch: PositionBatch) => DocumentCommandDispatchStatus;
}

export interface PreviewPositionCommitResult {
  status: DocumentCommandDispatchStatus;
  syncedPreviewNodeIds: string[];
  unmatchedPreviewNodeIds: string[];
  remainingPositionOverrides: DiagramPreviewPositionRecord;
}

/** 제출 전 매칭을 확정하고 미매칭·거절된 위치 초안을 보존한다. */
export function commitPreviewPositionOverrides(
  previewNodes: readonly DslPreviewNode[],
  positionOverrides: DiagramPreviewPositionRecord,
  persistedNodes: readonly TableNode[],
  actions: PreviewPositionBatchActions,
  onRejected: () => void,
): PreviewPositionCommitResult {
  const matches = matchPreviewNodesToPersistedNodes(previewNodes, persistedNodes);
  const tableMatchCounts = new Map<string, number>();
  for (const node of matches.values()) {
    tableMatchCounts.set(node.id, (tableMatchCounts.get(node.id) ?? 0) + 1);
  }
  const entries: PositionBatch['entries'] = [];
  for (const [previewNodeId, node] of matches) {
    const to = positionOverrides[previewNodeId];
    if (to && tableMatchCounts.get(node.id) === 1) {
      entries.push({ tableId: node.id, from: { ...node.position }, to: { ...to }, previewNodeId });
    }
  }
  const matchedIds = new Set(entries.map((entry) => entry.previewNodeId!));
  const unmatchedPreviewNodeIds = Object.keys(positionOverrides).filter(
    (id) => !matchedIds.has(id),
  );
  const status =
    entries.length === 0
      ? 'applied'
      : actions.available
        ? actions.applyPreviewPositions({ version: 1, batchId: crypto.randomUUID(), entries })
        : 'unavailable';
  if (status !== 'applied') onRejected();
  const syncedPreviewNodeIds = status === 'applied' ? [...matchedIds] : [];
  const syncedIds = new Set(syncedPreviewNodeIds);
  return {
    status,
    syncedPreviewNodeIds,
    unmatchedPreviewNodeIds,
    remainingPositionOverrides: Object.fromEntries(
      Object.entries(positionOverrides).filter(([id]) => !syncedIds.has(id)),
    ),
  };
}
