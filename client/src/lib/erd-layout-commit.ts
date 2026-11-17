import type { Node } from '@xyflow/react';
import type { DocumentCommandDispatchStatus } from '@/collaboration/core/session/document-mutation-session';
import type { PositionBatch } from '@/collaboration/plugins/erd/erd-position-batch';
import type { TableNodeData } from '@/types/erd';

type AppliedStatus = 'applied' | 'rejected';

export interface ErdLayoutMoveActions {
  available: boolean;
  applyLayout: (batch: PositionBatch) => DocumentCommandDispatchStatus;
}

/** 계산 전 좌표를 검증 기준으로 자동정렬 결과를 단일 문서 배치로 반영한다. */
export function commitErdLayoutNodes(
  nodes: Node<TableNodeData>[],
  fromNodes: readonly Node<TableNodeData>[],
  actions: ErdLayoutMoveActions,
  onRejected: () => void,
): AppliedStatus {
  const fromPositions = new Map(fromNodes.map((node) => [node.id, node.position]));
  if (!actions.available || nodes.some((node) => !fromPositions.has(node.id))) {
    onRejected();
    return 'rejected';
  }
  const status = actions.applyLayout({
    version: 1,
    batchId: crypto.randomUUID(),
    entries: nodes.map((node) => ({
      tableId: node.id,
      from: { ...fromPositions.get(node.id)! },
      to: { ...node.position },
    })),
  });
  if (status !== 'applied') {
    onRejected();
    return 'rejected';
  }
  return 'applied';
}
