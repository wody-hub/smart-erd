import { Check, X } from 'lucide-react';
import i18next from 'i18next';
import { approveAiProposal, cancelAiProposal } from '@/api/aiChatApi';
import { Button } from '@/components/ui/button';
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

            <AiProposalPreview proposal={proposal} />
          </section>
        );
      })}
    </section>
  );
}
