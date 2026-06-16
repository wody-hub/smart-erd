import { Check, ChevronDown, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import i18next from 'i18next';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  createAiChatContextFromOption,
  useAiChatContextOptions,
  type AiChatContextOption,
} from '@/hooks/useAiChatContextOptions';
import { cn } from '@/lib/utils';
import useAiChatStore from '@/stores/useAiChatStore';
import type { AiChatConfirmationCandidate, AiChatContextSnapshot } from '@/types/ai-chat';

interface AiChatContextBarProps {
  currentContext: AiChatContextSnapshot;
  selectedContext?: AiChatContextSnapshot | null;
  confirmationCandidates?: AiChatConfirmationCandidate[];
  onContextSelect?: (context: AiChatContextSnapshot | null) => void;
  className?: string;
}

export interface AiChatContextBarViewModel {
  currentLabel: string;
  stateKey: string;
  requiresSelection: boolean;
  confirmationOptions: AiChatContextOption[];
}

interface BuildAiChatContextBarViewModelInput {
  currentContext: AiChatContextSnapshot;
  selectedContext?: AiChatContextSnapshot | null;
  confirmationCandidates?: AiChatConfirmationCandidate[];
  options: AiChatContextOption[];
}

function contextLabel(context: AiChatContextSnapshot | null): string {
  if (!context) {
    return 'aiChat.context.scopeRequired';
  }
  return context.projectName || context.teamName || 'aiChat.context.scopeRequired';
}

function translateAiChatKey(key: string): string {
  return i18next.t(key as never) as string;
}

function candidateOption(candidate: AiChatConfirmationCandidate): AiChatContextOption {
  return {
    id: `candidate:${candidate.id}`,
    label: candidate.label || candidate.projectName || candidate.teamName || String(candidate.id),
    kind: candidate.kind,
    teamId: candidate.teamId,
    teamName: candidate.teamName ?? null,
    projectId: candidate.projectId ?? null,
    projectName: candidate.projectName ?? null,
    source: 'confirmation',
    reason: candidate.reason ?? null,
  };
}

export function buildAiChatContextBarViewModel({
  currentContext,
  selectedContext = null,
  confirmationCandidates = [],
  options,
}: BuildAiChatContextBarViewModelInput): AiChatContextBarViewModel {
  const activeContext = selectedContext ?? currentContext;
  const confirmationOptions =
    options.filter((option) => option.source === 'confirmation').length > 0
      ? options.filter((option) => option.source === 'confirmation')
      : confirmationCandidates.map(candidateOption);
  const isManual = selectedContext !== null;
  const requiresSelection = activeContext.kind === 'weak';

  return {
    currentLabel: contextLabel(activeContext),
    stateKey: isManual
      ? 'aiChat.context.manual'
      : requiresSelection
        ? 'aiChat.context.required'
        : currentContext.kind === 'team'
          ? 'aiChat.context.team'
          : 'aiChat.context.inherited',
    requiresSelection,
    confirmationOptions,
  };
}

function optionGroup(options: AiChatContextOption[], source: AiChatContextOption['source']) {
  return options.filter((option) => option.source === source);
}

function optionSelected(option: AiChatContextOption, context: AiChatContextSnapshot | null) {
  if (!context) {
    return false;
  }
  return (
    option.kind === context.kind &&
    option.teamId === context.teamId &&
    option.projectId === context.projectId
  );
}

/**
 * Persistent AI scope bar with authorized manual options and confirmation choices.
 */
export default function AiChatContextBar({
  currentContext,
  selectedContext: controlledSelectedContext,
  confirmationCandidates: controlledConfirmationCandidates,
  onContextSelect,
  className,
}: AiChatContextBarProps) {
  const t = i18next.t.bind(i18next);
  const [open, setOpen] = useState(false);
  const storeSelectedContext = useAiChatStore((state) => state.selectedContext);
  const storeConfirmationCandidates = useAiChatStore((state) => state.confirmationCandidates);
  const setStoreSelectedContext = useAiChatStore((state) => state.setSelectedContext);
  const selectedContext = controlledSelectedContext ?? storeSelectedContext;
  const confirmationCandidates = controlledConfirmationCandidates ?? storeConfirmationCandidates;
  const optionTeamId = selectedContext?.teamId ?? currentContext.teamId;
  const { options, isLoading } = useAiChatContextOptions({
    teamId: optionTeamId,
    confirmationCandidates,
  });
  const model = useMemo(
    () =>
      buildAiChatContextBarViewModel({
        currentContext,
        selectedContext,
        confirmationCandidates,
        options,
      }),
    [confirmationCandidates, currentContext, options, selectedContext],
  );
  const authorizedOptions = optionGroup(options, 'authorized');
  const confirmationOptions = model.confirmationOptions;

  const selectContext = (context: AiChatContextSnapshot | null) => {
    if (onContextSelect) {
      onContextSelect(context);
    } else {
      setStoreSelectedContext(context);
    }
    setOpen(false);
  };

  const selectOption = (option: AiChatContextOption) => {
    selectContext(createAiChatContextFromOption(option));
  };

  return (
    <div
      className={cn(
        'border-b border-border/80 bg-secondary/45 px-4 py-3 text-sm text-foreground',
        className,
      )}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold leading-[1.3] text-muted-foreground">
          {t('aiChat.context.label')}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {model.currentLabel.startsWith('aiChat.')
            ? translateAiChatKey(model.currentLabel)
            : model.currentLabel}
        </span>
        <span
          className={cn(
            'rounded-md border px-2 py-1 text-[12px] font-semibold leading-[1.3]',
            model.requiresSelection
              ? 'border-destructive/35 text-destructive'
              : 'border-border/80 text-muted-foreground',
          )}
        >
          {translateAiChatKey(model.stateKey)}
        </span>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              aria-label={t('aiChat.context.selectorLabel')}
            >
              <span>{t('aiChat.context.change')}</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder={t('aiChat.context.searchPlaceholder')} />
              <CommandList>
                <CommandEmpty>{t('aiChat.context.emptyOptions')}</CommandEmpty>
                {confirmationOptions.length > 0 ? (
                  <>
                    <CommandGroup heading={t('aiChat.context.confirmationGroup')}>
                      {confirmationOptions.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.label}
                          onSelect={() => selectOption(option)}
                        >
                          <Check
                            className={cn(
                              'h-4 w-4',
                              optionSelected(option, selectedContext) ? 'opacity-100' : 'opacity-0',
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">{option.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                ) : null}
                <CommandGroup heading={t('aiChat.context.authorizedGroup')}>
                  {authorizedOptions.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.label}
                      onSelect={() => selectOption(option)}
                    >
                      <Check
                        className={cn(
                          'h-4 w-4',
                          optionSelected(option, selectedContext) ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {isLoading ? (
              <div className="border-t border-border/80 px-3 py-2 text-[12px] text-muted-foreground">
                {t('aiChat.context.loadingOptions')}
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        {selectedContext ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('aiChat.context.clearManual')}
                  onClick={() => selectContext(null)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('aiChat.context.clearManual')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </div>
  );
}
