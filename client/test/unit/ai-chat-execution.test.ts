import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAiChatRequest,
  createAiChatExecutionController,
  createAiProposalDecisionController,
  resolveAiChatCanSend,
} from '../../src/hooks/useAiChatExecution.js';
import type {
  AiActionProposalCard,
  AiActionProposalDecisionResponse,
  AiChatConfirmationCandidate,
  AiChatContextSnapshot,
  AiChatMessage,
  AiChatRequest,
  AiChatResponse,
} from '../../src/types/ai-chat.js';
import type { AiProviderAvailability } from '../../src/types/ai-provider.js';

function projectContext(): AiChatContextSnapshot {
  return {
    kind: 'project',
    teamId: '1',
    teamName: 'Platform Team',
    projectId: '10',
    projectName: 'Alpha Project',
    source: 'route',
    capturedAt: '2026-06-02T00:00:00Z',
    confidence: 'strong',
    scopeRequired: false,
  };
}

function teamContext(): AiChatContextSnapshot {
  return {
    kind: 'team',
    teamId: '1',
    teamName: 'Platform Team',
    projectId: null,
    projectName: null,
    source: 'route',
    capturedAt: '2026-06-02T00:00:00Z',
    confidence: 'team',
    scopeRequired: true,
  };
}

function response(candidates: AiChatConfirmationCandidate[] = []): AiChatResponse {
  return {
    status: candidates.length > 0 ? 'NEEDS_CONFIRMATION' : 'ANSWER',
    executionId: 'exec-1',
    requiresConfirmation: candidates.length > 0,
    confirmationReason: candidates.length > 0 ? '프로젝트를 선택하세요' : null,
    confirmationCandidates: candidates,
    context: {
      kind: 'project',
      teamId: '1',
      projectIds: ['10'],
      label: 'Alpha Project',
      toolsUsed: ['issues'],
      caps: { issues: 20 },
    },
    sourceChips: [{ projectName: 'Alpha Project', tool: 'issues', count: 3, projectId: '10' }],
    conclusion: candidates.length > 0 ? '' : '리스크 3건',
    confirmedFacts: candidates.length > 0 ? [] : ['지연 이슈 3건'],
    interpretation: candidates.length > 0 ? '' : '일정 점검이 필요합니다.',
    needsConfirmation: candidates.length > 0 ? ['프로젝트 범위를 선택하세요'] : [],
    proposals: [],
    error: null,
    errorState: null,
  };
}

function proposal(status: AiActionProposalCard['status'] = 'PENDING'): AiActionProposalCard {
  return {
    proposalId: 'proposal-1',
    status,
    executable: status === 'PENDING',
    actionType: 'issue.create',
    riskLevel: 'LOW',
    target: { type: 'issue', id: 'ISS-1', label: 'Risk issue', teamId: '1', projectId: '10' },
    title: 'Create issue',
    summary: 'Create a follow-up issue',
    fields: [],
    content: '',
    warnings: [],
    expiresAt: null,
    result: null,
    redactedErrorTitle: null,
    redactedErrorDetail: null,
  };
}

function createStoreRecorder() {
  const messages: AiChatMessage[] = [];
  const confirmationCandidates: AiChatConfirmationCandidate[][] = [];
  const runningExecutionIds: Array<string | null> = [];
  return {
    messages,
    confirmationCandidates,
    runningExecutionIds,
    store: {
      appendMessage: (message: AiChatMessage) => {
        messages.push(message);
      },
      setConfirmationCandidates: (candidates: AiChatConfirmationCandidate[]) => {
        confirmationCandidates.push(candidates);
      },
      setRunningExecutionId: (executionId: string | null) => {
        runningExecutionIds.push(executionId);
      },
    },
  };
}

test('resolveAiChatCanSend blocks empty message unavailable provider weak context and running state', () => {
  const base = {
    message: '리스크를 요약해줘',
    providerAvailability: 'AVAILABLE' as AiProviderAvailability,
    context: projectContext(),
    isRunning: false,
  };

  assert.equal(resolveAiChatCanSend(base).canSend, true);
  assert.equal(
    resolveAiChatCanSend({
      ...base,
      context: teamContext(),
    }).canSend,
    true,
  );
  assert.equal(resolveAiChatCanSend({ ...base, message: '   ' }).canSend, false);
  assert.equal(
    resolveAiChatCanSend({ ...base, providerAvailability: 'CODEX_NOT_FOUND' }).reason,
    'provider-unavailable',
  );
  assert.equal(
    resolveAiChatCanSend({
      ...base,
      context: { ...projectContext(), kind: 'weak', scopeRequired: true },
    }).reason,
    'context-required',
  );
  assert.equal(resolveAiChatCanSend({ ...base, isRunning: true }).reason, 'running');
});

test('buildAiChatRequest maps team context to MULTI_PROJECT contract', () => {
  const request = buildAiChatRequest({
    message: '  팀 전체 TODO 현황 알려줘  ',
    context: teamContext(),
    locale: 'ko',
  });

  assert.equal(request.message, '팀 전체 TODO 현황 알려줘');
  assert.equal(request.scopeMode, 'MULTI_PROJECT');
  assert.equal(request.teamId, '1');
  assert.equal(request.projectId, null);
  assert.equal(request.context?.kind, 'team');
});

test('chat execution appends normalized user and assistant messages and copies confirmation candidates', async () => {
  const recorder = createStoreRecorder();
  const candidates: AiChatConfirmationCandidate[] = [
    {
      id: 'project-10',
      label: 'Alpha Project',
      kind: 'project',
      teamId: '1',
      teamName: null,
      projectId: '10',
      projectName: 'Alpha Project',
      reason: 'exact-name',
    },
  ];
  const requests: AiChatRequest[] = [];
  const controller = createAiChatExecutionController({
    execute: async (request: AiChatRequest) => {
      requests.push(request);
      return response(candidates);
    },
    store: recorder.store,
    createId: (() => {
      let next = 1;
      return () => `msg-${next++}`;
    })(),
    now: () => '2026-06-02T00:00:00Z',
  });

  await controller.send({
    message: 'Alpha 프로젝트 리스크를 알려줘',
    context: projectContext(),
    locale: 'ko',
  });

  assert.equal(requests[0]?.message, 'Alpha 프로젝트 리스크를 알려줘');
  assert.equal(requests[0]?.context?.projectId, '10');
  assert.equal(recorder.messages.length, 2);
  assert.equal(recorder.messages[0]?.role, 'user');
  assert.equal(recorder.messages[0]?.context?.projectId, '10');
  assert.equal(recorder.messages[1]?.role, 'assistant');
  assert.equal(recorder.messages[1]?.content, '프로젝트 범위를 선택하세요');
  assert.deepEqual(recorder.messages[1]?.response?.confirmationCandidates, candidates);
  assert.deepEqual(recorder.confirmationCandidates.at(-1), candidates);
  assert.deepEqual(recorder.runningExecutionIds, ['msg-2', null]);
  assert.equal(JSON.stringify(recorder.messages).includes('rawProviderOutput'), false);
});

test('stopWaiting aborts the current request clears running state and preserves transcript', async () => {
  const recorder = createStoreRecorder();
  const capture: { signal: AbortSignal | null } = { signal: null };
  const controller = createAiChatExecutionController({
    execute: async (_request: AiChatRequest, signal: AbortSignal) => {
      capture.signal = signal;
      return new Promise<AiChatResponse>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    },
    store: recorder.store,
    createId: (() => {
      let next = 1;
      return () => `msg-${next++}`;
    })(),
    now: () => '2026-06-02T00:00:00Z',
  });

  const sendPromise = controller.send({
    message: '응답을 중지할 질문',
    context: projectContext(),
    locale: 'ko',
  });
  await Promise.resolve();

  assert.equal(capture.signal?.aborted, false);
  controller.stopWaiting(projectContext());
  await sendPromise;

  assert.equal(capture.signal?.aborted, true);
  assert.equal(controller.isRunning(), false);
  assert.deepEqual(recorder.runningExecutionIds, ['msg-2', null, null]);
  assert.equal(recorder.messages[0]?.role, 'user');
  assert.equal(recorder.messages[0]?.content, '응답을 중지할 질문');
  assert.equal(recorder.messages.at(-1)?.response?.errorState?.code, 'LOCAL_STOP_WAITING');
});

test('11-W3-04 proposal decision controller updates a single existing proposal', async () => {
  const updates: Array<{ messageId: string; proposal: AiActionProposalCard }> = [];
  const decision: AiActionProposalDecisionResponse = {
    proposal: proposal('EXECUTED'),
    decision: 'APPROVE',
    terminal: true,
    message: 'ai.proposal.executed',
  };
  const controller = createAiProposalDecisionController({
    messageId: 'assistant-1',
    store: {
      updateProposalInMessage: (messageId, nextProposal) => {
        updates.push({ messageId, proposal: nextProposal });
      },
    },
    approve: async () => decision,
  });

  const result = await controller.approve('proposal-1');

  assert.deepEqual(result, decision);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.messageId, 'assistant-1');
  assert.equal(updates[0]?.proposal.status, 'EXECUTED');
});
