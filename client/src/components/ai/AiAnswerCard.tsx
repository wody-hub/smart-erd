import { AlertTriangle, CheckCircle2, CircleHelp, Lightbulb } from 'lucide-react';
import type { ReactNode } from 'react';
import i18next from 'i18next';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AiChatMessage, AiChatResponse } from '@/types/ai-chat';
import AiSourceChips from './AiSourceChips';

interface AiAnswerCardProps {
  response: AiChatResponse;
  message?: AiChatMessage;
  className?: string;
}

interface AnswerSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(items: string[]): boolean {
  return items.some(hasText);
}

function AnswerSection({ title, icon, children }: AnswerSectionProps) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-[12px] font-semibold leading-[1.3] text-muted-foreground">
        {icon}
        <span>{title}</span>
      </h4>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm leading-6 text-foreground">
      {items.filter(hasText).map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-[0.6875rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Renders a structured assistant answer with response-backed source metadata.
 */
export default function AiAnswerCard({ response, className }: AiAnswerCardProps) {
  const t = i18next.t.bind(i18next);
  const hasFacts = hasItems(response.confirmedFacts);
  const hasInterpretation = hasText(response.interpretation);
  const hasNeedsConfirmation = hasItems(response.needsConfirmation);

  if (response.status === 'ERROR') {
    const fallback = t('aiChat.error.fallback');

    return (
      <Card role="alert" className={cn('border-destructive/35 bg-card', className)}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold leading-5 text-foreground">
                {t('aiChat.error.title')}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">{response.error || fallback}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-card', className)}>
      <CardContent className="space-y-4 p-4">
        {hasText(response.conclusion) ? (
          <p className="text-sm font-medium leading-6 text-foreground">{response.conclusion}</p>
        ) : null}

        <AiSourceChips chips={response.sourceChips} />

        {hasFacts ? (
          <AnswerSection
            title={t('aiChat.answer.confirmedFacts')}
            icon={<CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          >
            <BulletList items={response.confirmedFacts} />
          </AnswerSection>
        ) : null}

        {hasInterpretation ? (
          <AnswerSection
            title={t('aiChat.answer.interpretation')}
            icon={<Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          >
            <p className="text-sm leading-6 text-foreground">{response.interpretation}</p>
          </AnswerSection>
        ) : null}

        {hasNeedsConfirmation ? (
          <AnswerSection
            title={t('aiChat.answer.needsConfirmation')}
            icon={<CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          >
            <BulletList items={response.needsConfirmation} />
          </AnswerSection>
        ) : null}
      </CardContent>
    </Card>
  );
}
