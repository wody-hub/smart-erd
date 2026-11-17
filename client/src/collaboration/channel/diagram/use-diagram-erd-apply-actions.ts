import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import type { DdlParseResult } from '@/lib/ddl-parser';
import type { ApplyDiffResult } from '@/lib/erd-diff-apply';
import type { DiffPlan } from '@/lib/erd-diff-plan';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import { resolveDiagramDocumentStatus } from '@/collaboration/channel/diagram/diagram-session-action-utils';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';
import { commitErdLayoutNodes } from '@/lib/erd-layout-commit';
import type { TableNodeData } from '@/types/erd';

type AppliedStatus = 'applied' | 'rejected';

export interface DiagramErdApplyActions {
  applyLayout: (
    nodes: Node<TableNodeData>[],
    fromNodes: readonly Node<TableNodeData>[],
  ) => AppliedStatus;
  replaceFromDdl: (result: DdlParseResult) => AppliedStatus;
  applyDiffPlan: (plan: DiffPlan) => ApplyDiffResult | null;
  updateGroupTables: (groupId: string, toAdd: string[], toRemove: string[]) => AppliedStatus;
}

export function useDiagramErdApplyActions(): DiagramErdApplyActions {
  const erdDocumentActions = useErdDocumentActions();
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
      applyLayout: (nodes: Node<TableNodeData>[], fromNodes: readonly Node<TableNodeData>[]) => {
        return commitErdLayoutNodes(nodes, fromNodes, erdDocumentActions, notifyRejected);
      },
      replaceFromDdl: (result: DdlParseResult) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.replaceFromDdl(result),
          notifyRejected,
        );
      },
      applyDiffPlan: (plan: DiffPlan) => {
        const result = erdDocumentActions.applyDiffPlan(plan);
        return resolveDiagramDocumentStatus(result.status, notifyRejected) === 'applied'
          ? (result.value ?? null)
          : null;
      },
      updateGroupTables: (groupId: string, toAdd: string[], toRemove: string[]) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.updateGroupTables(groupId, toAdd, toRemove),
          notifyRejected,
        );
      },
    }),
    [erdDocumentActions, notifyRejected],
  );
}
