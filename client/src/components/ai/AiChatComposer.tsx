import { Loader2, Send, X } from 'lucide-react';
import type { FormEvent } from 'react';
import i18next from 'i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AiProviderAvailability } from '@/types/ai-provider';

interface AiChatComposerProps {
  message: string;
  onMessageChange: (message: string) => void;
  canSend: boolean;
  isRunning: boolean;
  providerAvailability?: AiProviderAvailability | null;
  contextRequired?: boolean;
  send: () => void | Promise<void>;
  stopWaiting: () => void;
  className?: string;
}

export interface ResolveAiChatComposerStateInput {
  message: string;
  providerAvailability?: AiProviderAvailability | null;
  contextRequired: boolean;
  canSend: boolean;
  isRunning: boolean;
}

export interface AiChatComposerState {
  sendDisabled: boolean;
  showStopWaiting: boolean;
  buttonLabelKey: string;
  statusKey: string;
}

function translateAiChatKey(key: string): string {
  return i18next.t(key as never) as string;
}

export function resolveAiChatComposerState({
  message,
  providerAvailability,
  contextRequired,
  canSend,
  isRunning,
}: ResolveAiChatComposerStateInput): AiChatComposerState {
  if (isRunning) {
    return {
      sendDisabled: true,
      showStopWaiting: true,
      buttonLabelKey: 'aiChat.composer.stopWaiting',
      statusKey: 'aiChat.composer.running',
    };
  }
  if (message.trim().length === 0) {
    return {
      sendDisabled: true,
      showStopWaiting: false,
      buttonLabelKey: 'aiChat.composer.send',
      statusKey: 'aiChat.composer.disabled.empty',
    };
  }
  if (providerAvailability !== 'AVAILABLE') {
    return {
      sendDisabled: true,
      showStopWaiting: false,
      buttonLabelKey: 'aiChat.composer.send',
      statusKey: 'aiChat.composer.disabled.provider',
    };
  }
  if (contextRequired) {
    return {
      sendDisabled: true,
      showStopWaiting: false,
      buttonLabelKey: 'aiChat.composer.send',
      statusKey: 'aiChat.composer.disabled.context',
    };
  }
  return {
    sendDisabled: !canSend,
    showStopWaiting: false,
    buttonLabelKey: 'aiChat.composer.send',
    statusKey: canSend ? 'aiChat.composer.ready' : 'aiChat.composer.disabled.context',
  };
}

/**
 * Bottom composer for synchronous AI chat send and local stop-waiting control.
 */
export default function AiChatComposer({
  message,
  onMessageChange,
  canSend,
  isRunning,
  providerAvailability,
  contextRequired = false,
  send,
  stopWaiting,
  className,
}: AiChatComposerProps) {
  const t = i18next.t.bind(i18next);
  const state = resolveAiChatComposerState({
    message,
    providerAvailability,
    contextRequired,
    canSend,
    isRunning,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.showStopWaiting) {
      stopWaiting();
      return;
    }
    if (!state.sendDisabled) {
      void send();
    }
  };

  return (
    <form
      className={cn('border-t border-border/80 bg-card px-4 py-3', className)}
      onSubmit={submit}
    >
      <div className="flex items-end gap-2">
        <Textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder={t('aiChat.composer.placeholder')}
          aria-label={t('aiChat.composer.inputLabel')}
          className="max-h-40 min-h-11 resize-none"
          disabled={isRunning}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                className="h-11 shrink-0 gap-2"
                disabled={state.sendDisabled && !state.showStopWaiting}
                aria-label={translateAiChatKey(state.buttonLabelKey)}
              >
                {state.showStopWaiting ? (
                  <>
                    <X className="h-4 w-4" aria-hidden="true" />
                    <span>{t('aiChat.composer.stopWaiting')}</span>
                  </>
                ) : (
                  <>
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{t('aiChat.composer.send')}</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translateAiChatKey(state.buttonLabelKey)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="mt-2 text-[12px] leading-[1.3] text-muted-foreground" aria-live="polite">
        {translateAiChatKey(state.statusKey)}
      </p>
    </form>
  );
}
