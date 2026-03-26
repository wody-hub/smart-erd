import { useMemo } from 'react';
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

type AppliedStatus = 'applied' | 'rejected';

export interface DiagramErdApplyActions {
  replaceFromDdl: (result: DdlParseResult) => AppliedStatus;
  applyDiffPlan: (plan: DiffPlan) => ApplyDiffResult | null;
  updateGroupTables: (groupId: string, toAdd: string[], toRemove: string[]) => AppliedStatus;
}

export function useDiagramErdApplyActions(): DiagramErdApplyActions {
  const erdDocumentActions = useErdDocumentActions();
  const replaceFromDdlFallback = useCanvasStore((state) => state.replaceFromDdl);
  const applyDiffPlanFallback = useCanvasStore((state) => state.applyDiffPlan);
  const updateGroupTablesFallback = useCanvasStore((state) => state.updateGroupTables);
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
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
      erdDocumentActions,
      notifyRejected,
      replaceFromDdlFallback,
      updateGroupTablesFallback,
    ],
  );
}
