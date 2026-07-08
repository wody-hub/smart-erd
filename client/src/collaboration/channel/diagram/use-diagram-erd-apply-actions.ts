import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import type { DdlParseResult } from '@/lib/ddl-parser';
import type { ApplyDiffResult } from '@/lib/erd-diff-apply';
import type { DiffPlan } from '@/lib/erd-diff-plan';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import {
  resolveDiagramActionResult,
  resolveDiagramAppliedStatus,
} from '@/collaboration/channel/diagram/diagram-session-action-utils';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';
import { commitErdLayoutNodes } from '@/lib/erd-layout-commit';
import type { TableNodeData } from '@/types/erd';

type AppliedStatus = 'applied' | 'rejected';

export interface DiagramErdApplyActions {
  applyLayout: (nodes: Node<TableNodeData>[]) => AppliedStatus;
  replaceFromDdl: (result: DdlParseResult) => AppliedStatus;
  applyDiffPlan: (plan: DiffPlan) => ApplyDiffResult | null;
  updateGroupTables: (groupId: string, toAdd: string[], toRemove: string[]) => AppliedStatus;
}

export function useDiagramErdApplyActions(): DiagramErdApplyActions {
  const erdDocumentActions = useErdDocumentActions();
  const applyLayoutFallback = useCanvasStore((state) => state.applyLayout);
  const replaceFromDdlFallback = useCanvasStore((state) => state.replaceFromDdl);
  const applyDiffPlanFallback = useCanvasStore((state) => state.applyDiffPlan);
  const updateGroupTablesFallback = useCanvasStore((state) => state.updateGroupTables);
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
      applyLayout: (nodes: Node<TableNodeData>[]) => {
        return commitErdLayoutNodes(nodes, erdDocumentActions, applyLayoutFallback, notifyRejected);
      },
      replaceFromDdl: (result: DdlParseResult) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.replaceFromDdl(result),
          () => replaceFromDdlFallback(result),
          notifyRejected,
        );
      },
      applyDiffPlan: (plan: DiffPlan) => {
        return resolveDiagramActionResult(
          erdDocumentActions.applyDiffPlan(plan),
          () => applyDiffPlanFallback(plan),
          notifyRejected,
        );
      },
      updateGroupTables: (groupId: string, toAdd: string[], toRemove: string[]) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.updateGroupTables(groupId, toAdd, toRemove),
          () => updateGroupTablesFallback(groupId, toAdd, toRemove),
          notifyRejected,
        );
      },
    }),
    [
      applyDiffPlanFallback,
      applyLayoutFallback,
      erdDocumentActions,
      notifyRejected,
      replaceFromDdlFallback,
      updateGroupTablesFallback,
    ],
  );
}
