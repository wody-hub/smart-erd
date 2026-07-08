import type { Node } from '@xyflow/react';
import { CANVAS_HISTORY_ORIGIN } from '@/constants/canvas-history';
import type { MutationMeta } from '@/collaboration/core/contracts/document-read-executor';
import type { DocumentCommandDispatchStatus } from '@/collaboration/core/session/document-mutation-session';
import type { TableNodeData } from '@/types/erd';

type AppliedStatus = 'applied' | 'rejected';

export interface ErdLayoutMoveActions {
  available: boolean;
  moveTable: (
    tableId: string,
    positionX: number,
    positionY: number,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
}

/**
 * 자동정렬 결과를 문서 mutation 경로로 반영한다.
 *
 * 협업 문서 액션이 준비된 경우 table:move 명령을 사용해야 서버 스냅샷/동기화 경로에 남는다.
 * 준비되지 않은 경우에만 기존 canvas store fallback을 사용한다.
 */
export function commitErdLayoutNodes(
  nodes: Node<TableNodeData>[],
  actions: ErdLayoutMoveActions,
  fallback: (nodes: Node<TableNodeData>[]) => void,
  onRejected: () => void,
): AppliedStatus {
  if (!actions.available) {
    fallback(nodes);
    return 'applied';
  }

  const rejected = nodes.some((node) => {
    const status = actions.moveTable(node.id, node.position.x, node.position.y, {
      origin: { source: 'local', requestId: CANVAS_HISTORY_ORIGIN.USER_LAYOUT },
    });
    return status === 'rejected';
  });

  fallback(nodes);
  if (rejected) {
    onRejected();
    return 'rejected';
  }

  return 'applied';
}
