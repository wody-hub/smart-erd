import { Bot, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useAiProviderStatus } from '@/hooks/useAiProviderStatus';
import { cn } from '@/lib/utils';
import {
  getAiProviderAvailabilityPresentation,
  isAiProviderAvailability,
  type AiProviderDisplayAvailability,
  type AiProviderStatusTone,
} from '@/types/ai-provider';

const TONE_CLASS: Record<AiProviderStatusTone, string> = {
  ready: 'border-primary/35 bg-primary/10 text-primary',
  warning: 'border-border/80 bg-secondary/70 text-foreground',
  error: 'border-destructive/35 bg-card text-destructive',
  muted: 'border-border/80 bg-muted/50 text-muted-foreground',
};

function resolveDisplayAvailability(
  value: unknown,
  isLoading: boolean,
  isError: boolean,
): AiProviderDisplayAvailability {
  if (isLoading) {
    return 'CHECKING';
  }
  if (isError || !isAiProviderAvailability(value)) {
    return 'UNKNOWN';
  }
  return value;
}

export default function AiProviderStatusBadge() {
  const { t } = useTranslation();
  const { data, isError, isLoading } = useAiProviderStatus();
  const availability = resolveDisplayAvailability(data?.availability, isLoading, isError);
  const presentation = getAiProviderAvailabilityPresentation(availability);
  const label = t(presentation.labelKey);

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-10 gap-2 rounded-md px-3 text-sm font-medium',
        TONE_CLASS[presentation.tone],
      )}
      aria-label={t('aiProvider.aria.status', { status: label })}
      aria-live="polite"
    >
      {availability === 'CHECKING' ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Bot className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="whitespace-nowrap">{t('aiProvider.statusLabel', { status: label })}</span>
    </Badge>
  );
}
