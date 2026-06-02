import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { AiChatContextSnapshot } from '@/types/ai-chat';

export interface AiRouteContextInput {
  pathname: string;
  teamId?: string | null;
  projectId?: string | null;
  teamName?: string | null;
  projectName?: string | null;
  manualContext?: AiChatContextSnapshot | null;
}

export interface UseAiRouteContextOptions {
  manualContext?: AiChatContextSnapshot | null;
  teamName?: string | null;
  projectName?: string | null;
}

interface ParsedRouteScope {
  teamId: string | null;
  projectId: string | null;
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

function normalizeId(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRouteScope(pathname: string): ParsedRouteScope {
  const projectMatch = /^\/teams\/([^/]+)\/projects\/([^/]+)(?:\/|$)/.exec(pathname);
  if (projectMatch) {
    return {
      teamId: projectMatch[1],
      projectId: projectMatch[2],
    };
  }

  const teamMatch = /^\/teams\/([^/]+)(?:\/|$)/.exec(pathname);
  if (teamMatch) {
    return {
      teamId: teamMatch[1],
      projectId: null,
    };
  }

  return {
    teamId: null,
    projectId: null,
  };
}

function createWeakContext(): AiChatContextSnapshot {
  return {
    kind: 'weak',
    teamId: null,
    teamName: null,
    projectId: null,
    projectName: null,
    source: 'required',
    capturedAt: currentTimestamp(),
    confidence: 'weak',
    scopeRequired: true,
  };
}

export function deriveAiRouteContext(input: AiRouteContextInput): AiChatContextSnapshot {
  if (input.manualContext) {
    return {
      ...input.manualContext,
      source: 'manual',
    };
  }

  const parsed = parseRouteScope(input.pathname);
  const teamId = normalizeId(input.teamId) ?? parsed.teamId;
  const projectId = normalizeId(input.projectId) ?? parsed.projectId;

  if (teamId && projectId) {
    return {
      kind: 'project',
      teamId,
      teamName: input.teamName ?? null,
      projectId,
      projectName: input.projectName ?? null,
      source: 'route',
      capturedAt: currentTimestamp(),
      confidence: 'strong',
      scopeRequired: false,
    };
  }

  if (teamId) {
    return {
      kind: 'team',
      teamId,
      teamName: input.teamName ?? null,
      projectId: null,
      projectName: null,
      source: 'route',
      capturedAt: currentTimestamp(),
      confidence: 'team',
      scopeRequired: true,
    };
  }

  return createWeakContext();
}

export function requiresExplicitAiScope(context: AiChatContextSnapshot): boolean {
  return context.kind === 'weak';
}

export function createAiSendContextSnapshot(context: AiChatContextSnapshot): AiChatContextSnapshot {
  return {
    ...context,
    capturedAt: currentTimestamp(),
  };
}

export function useAiRouteContext(options: UseAiRouteContextOptions = {}): AiChatContextSnapshot {
  const location = useLocation();
  const params = useParams<{ teamId?: string; projectId?: string }>();
  const teamId = normalizeId(params.teamId);
  const projectId = normalizeId(params.projectId);

  return useMemo(
    () =>
      deriveAiRouteContext({
        pathname: location.pathname,
        teamId,
        projectId,
        teamName: options.teamName ?? null,
        projectName: options.projectName ?? null,
        manualContext: options.manualContext ?? null,
      }),
    [
      location.pathname,
      options.manualContext,
      options.projectName,
      options.teamName,
      projectId,
      teamId,
    ],
  );
}
