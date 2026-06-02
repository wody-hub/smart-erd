import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Bot, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AiAnswerCard from '@/components/ai/AiAnswerCard';
import AiChatComposer from '@/components/ai/AiChatComposer';
import AiChatContextBar from '@/components/ai/AiChatContextBar';
import AiProviderStatusBadge from '@/components/ai/AiProviderStatusBadge';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAiProviderStatus } from '@/hooks/useAiProviderStatus';
import { useAiChatExecution } from '@/hooks/useAiChatExecution';
import { useAiRouteContext } from '@/hooks/useAiRouteContext';
import { cn } from '@/lib/utils';
import useAiChatStore from '@/stores/useAiChatStore';
import type { AiProviderAvailability } from '@/types/ai-provider';
import type {
  AiChatConfirmationCandidate,
  AiChatContextSnapshot,
  AiChatMessage,
} from '@/types/ai-chat';

export interface AiChatDrawerViewModelInput {
  messages: AiChatMessage[];
  routeContext: AiChatContextSnapshot;
  selectedContext: AiChatContextSnapshot | null;
  confirmationCandidates: AiChatConfirmationCandidate[];
  providerAvailability?: AiProviderAvailability | null;
  isRunning: boolean;
}

export interface AiChatDrawerViewModel {
  titleKey: string;
  activeContext: AiChatContextSnapshot;
  hasMessages: boolean;
  contextRequired: boolean;
  canStartNewConversation: boolean;
  canSend: boolean;
  confirmationCandidateCount: number;
}

export function buildAiChatDrawerViewModel({
  messages,
  routeContext,
  selectedContext,
  confirmationCandidates,
  providerAvailability,
  isRunning,
}: AiChatDrawerViewModelInput): AiChatDrawerViewModel {
  const activeContext = selectedContext ?? routeContext;
  const hasMessages = messages.length > 0;
  const contextRequired = activeContext.kind === 'weak';

  return {
    titleKey: 'aiChat.drawer.title',
    activeContext,
    hasMessages,
    contextRequired,
    canStartNewConversation: hasMessages || confirmationCandidates.length > 0,
    canSend: providerAvailability === 'AVAILABLE' && !isRunning && !contextRequired,
    confirmationCandidateCount: confirmationCandidates.length,
  };
}

function UserMessage({ message }: { message: AiChatMessage }) {
  return (
    <article className="ml-auto max-w-[88%] rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm leading-6 text-foreground">
      {message.content}
    </article>
  );
}

function AssistantMessage({ message }: { message: AiChatMessage }) {
  if (message.response) {
    return <AiAnswerCard response={message.response} message={message} />;
  }

  return (
    <article className="max-w-[92%] rounded-md border border-border/80 bg-secondary/55 px-3 py-2 text-sm leading-6 text-foreground">
      {message.content}
    </article>
  );
}

function translateAiChatKey(t: (key: never) => string, key: string): string {
  return t(key as never);
}

function Transcript({ messages }: { messages: AiChatMessage[] }) {
  const { t } = useTranslation();

  if (messages.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border/80 bg-secondary/70 text-primary">
          <Bot className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold leading-[1.15] text-foreground">
            {t('aiChat.empty.heading')}
          </h3>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            {t('aiChat.empty.body')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
        >
          {message.role === 'user' ? (
            <UserMessage message={message} />
          ) : (
            <AssistantMessage message={message} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Global right-side AI chat drawer for authenticated app screens.
 */
export default function AiChatDrawer() {
  const { t, i18n } = useTranslation();
  const [draftMessage, setDraftMessage] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const isOpen = useAiChatStore((state) => state.isOpen);
  const messages = useAiChatStore((state) => state.messages);
  const selectedContext = useAiChatStore((state) => state.selectedContext);
  const confirmationCandidates = useAiChatStore((state) => state.confirmationCandidates);
  const openDrawer = useAiChatStore((state) => state.openDrawer);
  const closeDrawer = useAiChatStore((state) => state.closeDrawer);
  const newConversation = useAiChatStore((state) => state.newConversation);
  const setSelectedContext = useAiChatStore((state) => state.setSelectedContext);
  const routeContext = useAiRouteContext();
  const { data: providerStatus } = useAiProviderStatus();
  const providerAvailability = providerStatus?.availability ?? null;
  const execution = useAiChatExecution({
    message: draftMessage,
    context: routeContext,
    selectedContext,
    providerAvailability,
    locale: i18n.language,
  });
  const model = useMemo(
    () =>
      buildAiChatDrawerViewModel({
        messages,
        routeContext,
        selectedContext,
        confirmationCandidates,
        providerAvailability,
        isRunning: execution.isRunning,
      }),
    [
      confirmationCandidates,
      execution.isRunning,
      messages,
      providerAvailability,
      routeContext,
      selectedContext,
    ],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      openDrawer();
    } else {
      closeDrawer();
    }
  };

  const handleSend = async () => {
    if (!execution.canSend) {
      return;
    }
    const sentMessage = draftMessage;
    await execution.send();
    if (sentMessage.trim().length > 0) {
      setDraftMessage('');
    }
  };

  const confirmNewConversation = () => {
    newConversation();
    setNewConversationOpen(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-[min(520px,100vw)] flex-col border-l border-border/85 bg-card font-sans text-foreground shadow-editorial-strong outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-[520px]"
            aria-label={t('aiChat.aria.drawer')}
          >
            <header className="flex shrink-0 items-start gap-3 border-b border-border/80 bg-card px-4 py-4">
              <div className="min-w-0 flex-1 space-y-1">
                <DialogPrimitive.Title className="text-xl font-semibold leading-[1.2] text-foreground">
                  {translateAiChatKey(t, model.titleKey)}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm leading-6 text-muted-foreground">
                  {model.contextRequired
                    ? t('aiChat.context.requiredBody')
                    : t('aiChat.composer.ready')}
                </DialogPrimitive.Description>
              </div>
              <AiProviderStatusBadge />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-2"
                      onClick={() => setNewConversationOpen(true)}
                      disabled={!model.canStartNewConversation}
                      aria-label={t('aiChat.aria.newConversation')}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{t('aiChat.newConversation.label')}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('aiChat.newConversation.label')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogPrimitive.Close asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label={t('aiChat.aria.close')}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DialogPrimitive.Close>
                  </TooltipTrigger>
                  <TooltipContent>{t('aiChat.drawer.close')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </header>

            <AiChatContextBar
              currentContext={routeContext}
              selectedContext={selectedContext}
              confirmationCandidates={confirmationCandidates}
              onContextSelect={setSelectedContext}
            />

            <main
              className="min-h-0 flex-1 overflow-y-auto bg-background"
              aria-label={t('aiChat.aria.transcript')}
            >
              <Transcript messages={messages} />
            </main>

            <AiChatComposer
              message={draftMessage}
              onMessageChange={setDraftMessage}
              canSend={execution.canSend}
              isRunning={execution.isRunning}
              providerAvailability={providerAvailability}
              contextRequired={model.contextRequired}
              send={handleSend}
              stopWaiting={execution.stopWaiting}
            />
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <ConfirmDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        title={t('aiChat.newConversation.title')}
        description={t('aiChat.newConversation.body')}
        confirmLabel={t('aiChat.newConversation.confirm')}
        confirmVariant="destructive"
        onConfirm={confirmNewConversation}
      />
    </>
  );
}
