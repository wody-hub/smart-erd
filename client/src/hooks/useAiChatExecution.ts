import { useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { executeAiChat } from '@/api/aiChatApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import useAiChatStore from '@/stores/useAiChatStore';
import type {
  AiChatConfirmationCandidate,
  AiChatContextSnapshot,
  AiChatMessage,
  AiChatRequest,
  AiChatResponse,
  AiChatResponseContext,
  AiChatSourceChip,
} from '@/types/ai-chat';
import type { AiProviderAvailability } from '@/types/ai-provider';

export type AiChatCanSendReason =
  | 'empty-message'
  | 'provider-unavailable'
  | 'context-required'
  | 'running';

export interface AiChatCanSendInput {
  message: string;
  providerAvailability?: AiProviderAvailability | null;
  context?: AiChatContextSnapshot | null;
  isRunning: boolean;
}

export interface AiChatCanSendResult {
  canSend: boolean;
  reason: AiChatCanSendReason | null;
}

export interface AiChatExecutionSendInput {
  message: string;
  context: AiChatContextSnapshot | null;
  selectedContext?: AiChatContextSnapshot | null;
  locale?: string | null;
}

export interface AiChatExecutionStoreAdapter {
  appendMessage: (message: AiChatMessage) => void;
  setConfirmationCandidates: (candidates: AiChatConfirmationCandidate[]) => void;
  setRunningExecutionId: (executionId: string | null) => void;
}

export interface AiChatExecutionControllerOptions {
  execute: (request: AiChatRequest, signal: AbortSignal) => Promise<AiChatResponse>;
  store: AiChatExecutionStoreAdapter;
  createAbortController?: () => AbortController;
  createId?: () => string;
  now?: () => string;
  errorFallback?: string;
  stoppedWaitingMessage?: string;
}

export interface AiChatExecutionController {
  send: (input: AiChatExecutionSendInput) => Promise<void>;
  stopWaiting: (context?: AiChatContextSnapshot | null) => void;
  isRunning: () => boolean;
}

export interface UseAiChatExecutionOptions extends AiChatExecutionSendInput {
  providerAvailability?: AiProviderAvailability | null;
}

export interface UseAiChatExecutionResult {
  isRunning: boolean;
  canSend: boolean;
  disabledReason: AiChatCanSendReason | null;
  send: () => Promise<void>;
  stopWaiting: () => void;
}

interface RunningExecution {
  assistantMessageId: string;
  controller: AbortController;
  context: AiChatContextSnapshot | null;
  stopped: boolean;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeSourceChip(chip: AiChatSourceChip): AiChatSourceChip {
  return {
    projectName: normalizeText(chip.projectName),
    tool: chip.tool,
    count: Number.isFinite(chip.count) ? chip.count : 0,
    teamName: chip.teamName ?? null,
    projectId: chip.projectId ?? null,
  };
}

function normalizeConfirmationCandidate(
  candidate: AiChatConfirmationCandidate,
): AiChatConfirmationCandidate {
  return {
    id: normalizeText(candidate.id),
    label: normalizeText(candidate.label),
    kind: candidate.kind,
    teamId: candidate.teamId ?? null,
    teamName: candidate.teamName ?? null,
    projectId: candidate.projectId ?? null,
    projectName: candidate.projectName ?? null,
    reason: candidate.reason ?? null,
  };
}

function normalizeResponseContext(
  context: AiChatResponseContext | null | undefined,
): AiChatResponseContext | null {
  if (!context) {
    return null;
  }
  return {
    kind: normalizeText(context.kind),
    teamId: context.teamId ?? null,
    projectIds: Array.isArray(context.projectIds) ? [...context.projectIds] : [],
    label: normalizeText(context.label),
    toolsUsed: normalizeStringList(context.toolsUsed),
    caps: context.caps && typeof context.caps === 'object' ? { ...context.caps } : {},
  };
}

export function resolveAiChatCanSend(input: AiChatCanSendInput): AiChatCanSendResult {
  if (input.isRunning) {
    return { canSend: false, reason: 'running' };
  }
  if (input.message.trim().length === 0) {
    return { canSend: false, reason: 'empty-message' };
  }
  if (input.providerAvailability !== 'AVAILABLE') {
    return { canSend: false, reason: 'provider-unavailable' };
  }
  if (!input.context || input.context.kind === 'weak') {
    return { canSend: false, reason: 'context-required' };
  }
  return { canSend: true, reason: null };
}

export function resolveAiChatScopeMode(context: AiChatContextSnapshot | null): string | null {
  if (!context) {
    return null;
  }
  if (context.kind === 'team' || context.kind === 'multi-project') {
    return 'MULTI_PROJECT';
  }
  return context.kind;
}

export function buildAiChatRequest(input: AiChatExecutionSendInput): AiChatRequest {
  const context = input.selectedContext ?? input.context;
  const scopeMode = resolveAiChatScopeMode(context);
  const isMultiProjectScope = scopeMode === 'MULTI_PROJECT';
  return {
    message: input.message.trim(),
    teamId: context?.teamId ?? null,
    projectId: isMultiProjectScope ? null : (context?.projectId ?? null),
    projectName: context?.projectName ?? null,
    scopeMode,
    locale: input.locale ?? null,
    context,
    selectedContext: input.selectedContext ?? null,
  };
}

export function normalizeAiChatResponse(response: AiChatResponse): AiChatResponse {
  const confirmationCandidates = (response.confirmationCandidates ?? []).map(
    normalizeConfirmationCandidate,
  );
  return {
    status: response.status,
    requiresConfirmation:
      typeof response.requiresConfirmation === 'boolean'
        ? response.requiresConfirmation
        : response.status === 'NEEDS_CONFIRMATION',
    confirmationReason: response.confirmationReason ?? null,
    confirmationCandidates,
    context: normalizeResponseContext(response.context),
    sourceChips: (response.sourceChips ?? []).map(normalizeSourceChip),
    conclusion: normalizeText(response.conclusion),
    confirmedFacts: normalizeStringList(response.confirmedFacts),
    interpretation: normalizeText(response.interpretation),
    needsConfirmation: normalizeStringList(response.needsConfirmation),
    executionId: response.executionId ?? null,
    error: response.error ?? null,
    errorState: response.errorState
      ? {
          code: normalizeText(response.errorState.code),
          message: normalizeText(response.errorState.message),
          retryable: response.errorState.retryable === true,
        }
      : null,
  };
}

function assistantContent(response: AiChatResponse): string {
  if (response.status === 'ERROR') {
    return response.errorState?.message || response.error || 'aiChat.error.failed';
  }
  return (
    response.conclusion ||
    response.needsConfirmation[0] ||
    response.interpretation ||
    response.confirmedFacts[0] ||
    'aiChat.response.empty'
  );
}

function createAssistantMessage(
  id: string,
  response: AiChatResponse,
  context: AiChatContextSnapshot | null,
  createdAt: string,
): AiChatMessage {
  const normalized = normalizeAiChatResponse(response);
  return {
    id,
    role: 'assistant',
    content: assistantContent(normalized),
    createdAt,
    context,
    response: normalized,
    executionId: normalized.executionId ?? undefined,
  };
}

function localStopResponse(message: string): AiChatResponse {
  return {
    status: 'ERROR',
    requiresConfirmation: false,
    confirmationReason: null,
    confirmationCandidates: [],
    context: null,
    sourceChips: [],
    conclusion: '',
    confirmedFacts: [],
    interpretation: '',
    needsConfirmation: [],
    error: message,
    errorState: {
      code: 'LOCAL_STOP_WAITING',
      message,
      retryable: true,
    },
  };
}

function errorResponse(error: unknown, fallback: string): AiChatResponse {
  const message = getErrorMessage(error, fallback);
  return {
    status: 'ERROR',
    requiresConfirmation: false,
    confirmationReason: null,
    confirmationCandidates: [],
    context: null,
    sourceChips: [],
    conclusion: '',
    confirmedFacts: [],
    interpretation: '',
    needsConfirmation: [],
    error: message,
    errorState: {
      code: 'CHAT_REQUEST_FAILED',
      message,
      retryable: true,
    },
  };
}

export function createAiChatExecutionController(
  options: AiChatExecutionControllerOptions,
): AiChatExecutionController {
  let running: RunningExecution | null = null;
  const now = options.now ?? defaultNow;
  const createId = options.createId ?? defaultId;
  const createAbortController = options.createAbortController ?? (() => new AbortController());
  const errorFallback = options.errorFallback ?? 'aiChat.error.failed';
  const stoppedWaitingMessage = options.stoppedWaitingMessage ?? 'aiChat.execution.stoppedWaiting';

  return {
    async send(input) {
      if (running) {
        return;
      }
      const trimmed = input.message.trim();
      if (!trimmed) {
        return;
      }
      const context = input.selectedContext ?? input.context;
      const userMessageId = createId();
      const assistantMessageId = createId();
      const createdAt = now();
      options.store.appendMessage({
        id: userMessageId,
        role: 'user',
        content: trimmed,
        createdAt,
        context,
      });

      const abortController = createAbortController();
      const execution: RunningExecution = {
        assistantMessageId,
        controller: abortController,
        context,
        stopped: false,
      };
      running = execution;
      options.store.setRunningExecutionId(assistantMessageId);

      try {
        const response = await options.execute(
          buildAiChatRequest({ ...input, message: trimmed, context }),
          abortController.signal,
        );
        if (execution.stopped) {
          return;
        }
        const assistantMessage = createAssistantMessage(
          assistantMessageId,
          response,
          context,
          now(),
        );
        options.store.appendMessage(assistantMessage);
        options.store.setConfirmationCandidates(
          assistantMessage.response?.confirmationCandidates ?? [],
        );
      } catch (error) {
        if (!execution.stopped) {
          options.store.appendMessage(
            createAssistantMessage(
              assistantMessageId,
              errorResponse(error, errorFallback),
              context,
              now(),
            ),
          );
          options.store.setConfirmationCandidates([]);
        }
      } finally {
        if (running === execution) {
          running = null;
        }
        options.store.setRunningExecutionId(null);
      }
    },
    stopWaiting(context) {
      if (!running) {
        return;
      }
      const execution = running;
      execution.stopped = true;
      execution.controller.abort();
      options.store.appendMessage(
        createAssistantMessage(
          execution.assistantMessageId,
          localStopResponse(stoppedWaitingMessage),
          context ?? execution.context,
          now(),
        ),
      );
      options.store.setConfirmationCandidates([]);
      options.store.setRunningExecutionId(null);
    },
    isRunning() {
      return running !== null;
    },
  };
}

export function useAiChatExecution(options: UseAiChatExecutionOptions): UseAiChatExecutionResult {
  const appendMessage = useAiChatStore((state) => state.appendMessage);
  const setConfirmationCandidates = useAiChatStore((state) => state.setConfirmationCandidates);
  const setRunningExecutionId = useAiChatStore((state) => state.setRunningExecutionId);
  const runningExecutionId = useAiChatStore((state) => state.runningExecutionId);
  const mutation = useMutation({
    mutationKey: queryKeys.aiChat.send(),
    mutationFn: ({ request, signal }: { request: AiChatRequest; signal: AbortSignal }) =>
      executeAiChat(request, signal),
  });

  const mutationRef = useRef(mutation.mutateAsync);
  mutationRef.current = mutation.mutateAsync;
  const storeRef = useRef<AiChatExecutionStoreAdapter>({
    appendMessage,
    setConfirmationCandidates,
    setRunningExecutionId,
  });
  storeRef.current = {
    appendMessage,
    setConfirmationCandidates,
    setRunningExecutionId,
  };
  const controllerRef = useRef<AiChatExecutionController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createAiChatExecutionController({
      execute: (request, signal) => mutationRef.current({ request, signal }),
      store: {
        appendMessage: (message) => storeRef.current.appendMessage(message),
        setConfirmationCandidates: (candidates) =>
          storeRef.current.setConfirmationCandidates(candidates),
        setRunningExecutionId: (executionId) => storeRef.current.setRunningExecutionId(executionId),
      },
    });
  }
  const controller = controllerRef.current;

  const context = options.selectedContext ?? options.context;
  const isRunning = Boolean(runningExecutionId) || mutation.isPending || controller.isRunning();
  const canSendState = resolveAiChatCanSend({
    message: options.message,
    providerAvailability: options.providerAvailability,
    context,
    isRunning,
  });
  const send = useCallback(
    () =>
      controller.send({
        message: options.message,
        context: options.context,
        selectedContext: options.selectedContext,
        locale: options.locale,
      }),
    [controller, options.context, options.locale, options.message, options.selectedContext],
  );
  const stopWaiting = useCallback(() => controller.stopWaiting(context), [context, controller]);

  return {
    isRunning,
    canSend: canSendState.canSend,
    disabledReason: canSendState.reason,
    send,
    stopWaiting,
  };
}
