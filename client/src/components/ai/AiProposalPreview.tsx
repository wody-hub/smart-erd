import { AlertTriangle, FileText, ListChecks } from 'lucide-react';
import i18next from 'i18next';
import type { AiActionProposalCard } from '@/types/ai-chat';

interface AiProposalPreviewProps {
  proposal: AiActionProposalCard;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export default function AiProposalPreview({ proposal }: AiProposalPreviewProps) {
  const t = i18next.t.bind(i18next);
  const hasFields = proposal.fields.length > 0;
  const hasContent = hasText(proposal.content);
  const hasWarnings = proposal.warnings.some(hasText);

  if (!hasFields && !hasContent && !hasWarnings) {
    return (
      <p className="text-xs leading-5 text-muted-foreground">{t('aiChat.proposals.noPreview')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {hasFields ? (
        <section className="space-y-2">
          <h5 className="flex items-center gap-2 text-xs font-semibold leading-5 text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            {t('aiChat.proposals.fields')}
          </h5>
          <div className="divide-y divide-border/70 overflow-hidden rounded-md border border-border/70">
            {proposal.fields.map((field) => (
              <div
                key={`${field.label}-${field.afterValue ?? ''}`}
                className="grid gap-1 px-3 py-2 text-xs leading-5 sm:grid-cols-[8rem_1fr]"
              >
                <span className="font-medium text-muted-foreground">{field.label}</span>
                <span className="text-foreground">
                  {field.beforeValue ? `${field.beforeValue} -> ` : ''}
                  {field.afterValue || field.changeType || t('aiChat.proposals.emptyValue')}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasContent ? (
        <section className="space-y-2">
          <h5 className="flex items-center gap-2 text-xs font-semibold leading-5 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {t('aiChat.proposals.content')}
          </h5>
          <p className="rounded-md border border-border/70 bg-secondary/35 px-3 py-2 text-xs leading-5 text-foreground">
            {proposal.content}
          </p>
        </section>
      ) : null}

      {hasWarnings ? (
        <section className="space-y-1.5">
          {proposal.warnings.filter(hasText).map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-xs leading-5 text-erd-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{warning}</span>
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
