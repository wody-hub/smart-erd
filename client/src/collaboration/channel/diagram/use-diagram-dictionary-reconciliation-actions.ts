import { useMemo } from 'react';
import type { MutationMeta } from '@/collaboration/core/contracts/document-read-executor';
import { resolveDiagramDocumentStatus } from '@/collaboration/channel/diagram/diagram-session-action-utils';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import type { DiagramDictionaryReconciliationPlan } from '@/lib/diagram-dictionary-reconciliation';

type AppliedStatus = 'applied' | 'rejected';

export interface DiagramDictionaryReconciliationActions {
  reconcile: (plan: DiagramDictionaryReconciliationPlan, meta?: MutationMeta) => AppliedStatus;
}

export function useDiagramDictionaryReconciliationActions(): DiagramDictionaryReconciliationActions {
  const erdDocumentActions = useErdDocumentActions();
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
      reconcile: (plan: DiagramDictionaryReconciliationPlan, meta?: MutationMeta) =>
        resolveDiagramDocumentStatus(
          erdDocumentActions.reconcileDictionary(plan, meta),
          notifyRejected,
        ),
    }),
    [erdDocumentActions, notifyRejected],
  );
}
