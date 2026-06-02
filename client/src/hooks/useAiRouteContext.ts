import { useMemo } from 'react';
import type { AiChatContextSnapshot } from '@/types/ai-chat';

export interface AiRouteContextInput {
  pathname: string;
  teamName?: string | null;
  projectName?: string | null;
  manualContext?: AiChatContextSnapshot | null;
}

export function deriveAiRouteContext(input: AiRouteContextInput): AiChatContextSnapshot {
  if (input.manualContext) {
    return {
      ...input.manualContext,
      source: 'manual',
    };
  }
  return {
    kind: 'weak',
    teamId: null,
    teamName: null,
    projectId: null,
    projectName: null,
    source: 'required',
    capturedAt: new Date().toISOString(),
  };
}

export function requiresExplicitAiScope(context: AiChatContextSnapshot): boolean {
  return context.kind === 'weak';
}

export function createAiSendContextSnapshot(context: AiChatContextSnapshot): AiChatContextSnapshot {
  return {
    ...context,
    capturedAt: new Date().toISOString(),
  };
}

export function useAiRouteContext(input: AiRouteContextInput): AiChatContextSnapshot {
  return useMemo(() => deriveAiRouteContext(input), [input]);
}
