import { Check, CircleCheck, X } from 'lucide-react';
import i18next from 'i18next';
import { approveAiProposal, cancelAiProposal } from '@/api/aiChatApi';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/constants/query-keys';
import { queryClient } from '@/lib/query-client';
import useAiChatStore from '@/stores/useAiChatStore';
import type { AiActionProposalCard } from '@/types/ai-chat';
import AiProposalPreview from './AiProposalPreview';
import AiProposalStatusBadge from './AiProposalStatusBadge';

interface AiProposalPanelProps {
  proposals: AiActionProposalCard[];
  messageId?: string;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalidateExecutedProposal(proposal: AiActionProposalCard) {
  const teamId = proposal.target?.teamId == null ? null : String(proposal.target.teamId);
  const projectId = proposal.target?.projectId == null ? null : String(proposal.target.projectId);
  if (!teamId || !projectId) {
    return;
  }

  void queryClient.invalidateQueries({
    queryKey: ['teams', teamId, 'projects', projectId, 'ai-history'],
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.aiChat.proposal(proposal.proposalId) });

  const resourceType =
    proposal.result?.resourceType ?? proposal.target?.type ?? proposal.actionType;
  if (resourceType?.includes('issue')) {
    void queryClient.invalidateQueries({
      queryKey: ['teams', teamId, 'projects', projectId, 'issues'],
    });
  }
  if (resourceType?.includes('todo')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.projectTodos.all(teamId, projectId) });
  }
  if (resourceType?.includes('wbs')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all(teamId, projectId) });
    const wbsId = proposal.target?.id == null ? null : Number(proposal.target.id);
    if (Number.isFinite(wbsId)) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wbs.comments(teamId, projectId, wbsId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wbs.activities(teamId, projectId, wbsId),
      });
    }
  }
}

async function decideProposal(
  messageId: string | undefined,
  proposalId: string,
  action: 'approve' | 'cancel',
) {
  const decision =
    action === 'approve' ? await approveAiProposal(proposalId) : await cancelAiProposal(proposalId);
  if (messageId) {
    useAiChatStore.getState().updateProposalInMessage(messageId, decision.proposal);
  }
  if (decision.proposal.status === 'EXECUTED') {
    invalidateExecutedProposal(decision.proposal);
  }
}

export default function AiProposalPanel({ proposals, messageId }: AiProposalPanelProps) {
  const t = i18next.t.bind(i18next);
  if (proposals.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label={t('aiChat.proposals.sectionLabel')}>
      {proposals.map((proposal) => {
        const canDecide =
          proposal.status === 'PENDING' && proposal.executable && Boolean(messageId);
        const labelTitle = proposal.title || proposal.summary || proposal.actionType;
        return (
          <section
            key={proposal.proposalId}
            className="space-y-3 rounded-md border border-border/80 bg-secondary/25 p-3"
            aria-label={t('aiChat.proposals.itemLabel', { title: labelTitle })}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <AiProposalStatusBadge status={proposal.status} />
                  <span className="font-mono text-xs font-medium text-muted-foreground">
                    {proposal.proposalId}
                  </span>
                  {proposal.riskLevel ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('aiChat.proposals.risk', { risk: proposal.riskLevel })}
                    </span>
                  ) : null}
                </div>
                <h4 className="text-sm font-semibold leading-5 text-foreground">
                  {proposal.title || proposal.summary}
                </h4>
                {hasText(proposal.summary) ? (
                  <p className="text-sm leading-6 text-muted-foreground">{proposal.summary}</p>
                ) : null}
              </div>
              {canDecide ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void decideProposal(messageId, proposal.proposalId, 'approve')}
                  >
                    <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {t('aiChat.proposals.approve')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void decideProposal(messageId, proposal.proposalId, 'cancel')}
                  >
                    <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {t('aiChat.proposals.cancel')}
                  </Button>
                </div>
              ) : null}
            </div>

            <dl className="grid gap-2 text-xs leading-5 sm:grid-cols-2">
              {proposal.target?.label ? (
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('aiChat.proposals.target')}
                  </dt>
                  <dd className="text-foreground">{proposal.target.label}</dd>
                </div>
              ) : null}
              {proposal.expiresAt ? (
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('aiChat.proposals.expiresAt')}
                  </dt>
                  <dd className="text-foreground">{proposal.expiresAt}</dd>
                </div>
              ) : null}
            </dl>

            {proposal.status === 'PENDING' && !proposal.executable ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {t('aiChat.proposals.unsupported')}
              </p>
            ) : null}
            {proposal.redactedErrorTitle ? (
              <p className="text-xs leading-5 text-destructive">
                {proposal.redactedErrorTitle}
                {proposal.redactedErrorDetail ? ` - ${proposal.redactedErrorDetail}` : ''}
              </p>
            ) : null}
            {proposal.status === 'FAILED' || proposal.status === 'REJECTED' ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {t('aiChat.proposals.validationFailed')}
              </p>
            ) : null}
            {proposal.status === 'EXECUTED' && proposal.result ? (
              <section className="space-y-2 border-l-2 border-success/35 pl-3" aria-live="polite">
                <h5 className="flex items-center gap-2 text-xs font-semibold leading-5 text-success">
                  <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('aiChat.proposals.result')}
                </h5>
                <dl className="grid gap-2 text-xs leading-5 sm:grid-cols-2">
                  {hasText(proposal.result.summary) ? (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-muted-foreground">
                        {t('aiChat.proposals.summary')}
                      </dt>
                      <dd className="text-foreground">{proposal.result.summary}</dd>
                    </div>
                  ) : null}
                  {hasText(proposal.result.actionType) ? (
                    <div>
                      <dt className="font-medium text-muted-foreground">
                        {t('aiChat.proposals.actionType')}
                      </dt>
                      <dd className="font-mono text-foreground">{proposal.result.actionType}</dd>
                    </div>
                  ) : null}
                  {hasText(proposal.result.resourceId) ? (
                    <div>
                      <dt className="font-medium text-muted-foreground">
                        {t('aiChat.proposals.resourceId')}
                      </dt>
                      <dd className="font-mono text-foreground">{proposal.result.resourceId}</dd>
                    </div>
                  ) : null}
                  {hasText(proposal.result.targetLabel) ? (
                    <div>
                      <dt className="font-medium text-muted-foreground">
                        {t('aiChat.proposals.target')}
                      </dt>
                      <dd className="text-foreground">{proposal.result.targetLabel}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            <AiProposalPreview proposal={proposal} />
          </section>
        );
      })}
    </section>
  );
}
