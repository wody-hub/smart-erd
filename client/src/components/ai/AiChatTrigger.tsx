import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import useAiChatStore from '@/stores/useAiChatStore';

export interface AiChatTriggerPresentation {
  labelKey: string;
  ariaLabelKey: string;
  isActive: boolean;
}

interface AiChatTriggerProps {
  className?: string;
}

export function buildAiChatTriggerPresentation(isOpen: boolean): AiChatTriggerPresentation {
  return {
    labelKey: 'aiChat.drawer.triggerLabel',
    ariaLabelKey: 'aiChat.aria.trigger',
    isActive: isOpen,
  };
}

function translateAiChatKey(t: (key: never) => string, key: string): string {
  return t(key as never);
}

/**
 * Shared authenticated header trigger for the global AI chat drawer.
 */
export default function AiChatTrigger({ className }: AiChatTriggerProps) {
  const { t } = useTranslation();
  const isOpen = useAiChatStore((state) => state.isOpen);
  const openDrawer = useAiChatStore((state) => state.openDrawer);
  const presentation = buildAiChatTriggerPresentation(isOpen);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={openDrawer}
      aria-label={translateAiChatKey(t, presentation.ariaLabelKey)}
      aria-pressed={presentation.isActive}
      className={cn(
        'header-text-button h-8 gap-2 px-3',
        presentation.isActive && 'border-primary/35 bg-primary/10 text-primary',
        className,
      )}
    >
      <Bot className="h-4 w-4" aria-hidden="true" />
      <span>{translateAiChatKey(t, presentation.labelKey)}</span>
    </Button>
  );
}
