import i18next from 'i18next';
import type { AiChatSourceChip } from '@/types/ai-chat';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AiSourceChipsProps {
  chips: AiChatSourceChip[];
  className?: string;
}

function sourceChipScopeLabel(chip: AiChatSourceChip): string {
  return chip.projectName || chip.teamName || i18next.t('aiChat.sourceChips.currentScope');
}

function sourceChipKey(chip: AiChatSourceChip, index: number): string {
  return [chip.projectId ?? chip.projectName, chip.teamName, chip.tool, chip.count, index].join(
    ':',
  );
}

/**
 * Renders neutral, wrapping source metadata from the response context.
 */
export default function AiSourceChips({ chips, className }: AiSourceChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  const t = i18next.t.bind(i18next);

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      aria-label={t('aiChat.sourceChips.label')}
    >
      {chips.map((chip, index) => (
        <Badge
          key={sourceChipKey(chip, index)}
          variant="outline"
          className="min-h-8 rounded-md border-border/80 bg-secondary/60 px-2.5 py-1 text-[12px] font-semibold leading-snug text-foreground"
        >
          <span className="truncate">{sourceChipScopeLabel(chip)}</span>
          <span className="text-muted-foreground" aria-hidden="true">
            -
          </span>
          <span className="font-mono text-[11px]">{chip.tool}</span>
          <span className="tabular-nums">{chip.count}</span>
        </Badge>
      ))}
    </div>
  );
}
