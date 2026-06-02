import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AiChatDrawer from '@/components/ai/AiChatDrawer';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import useAiChatStore from '@/stores/useAiChatStore';

interface AuthenticatedAiChatShellProps {
  children: React.ReactNode;
}

export const AI_CHAT_PROTECTED_ROUTE_PATTERNS = [
  ROUTES.TEAMS,
  ROUTES.PROJECTS_PATTERN,
  ROUTES.DICTIONARY_PATTERN,
  ROUTES.DIAGRAMS_PATTERN,
  ROUTES.PROJECT_WBS_PATTERN,
  ROUTES.DIAGRAM_PATTERN,
] as const;

export function isAiChatShellRouteCovered(routePattern: string): boolean {
  return AI_CHAT_PROTECTED_ROUTE_PATTERNS.some((route) => route === routePattern);
}

function ShellFallbackTrigger() {
  const { t } = useTranslation();
  const isOpen = useAiChatStore((state) => state.isOpen);
  const openDrawer = useAiChatStore((state) => state.openDrawer);

  if (isOpen) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            onClick={openDrawer}
            aria-label={t('aiChat.aria.drawer')}
            className={cn(
              'fixed bottom-4 right-4 z-40 h-11 w-11 rounded-md shadow-editorial-strong',
              'border border-primary/35 bg-primary text-primary-foreground hover:bg-primary/95',
            )}
          >
            <Bot className="h-5 w-5" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('aiChat.drawer.triggerLabel')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Authenticated route shell that owns the global AI drawer and route-independent opener.
 */
export default function AuthenticatedAiChatShell({ children }: AuthenticatedAiChatShellProps) {
  return (
    <>
      {children}
      <AiChatDrawer />
      <ShellFallbackTrigger />
    </>
  );
}
