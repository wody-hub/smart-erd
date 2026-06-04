import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_CHAT_BASE_PATH,
  AI_PROPOSAL_BASE_PATH,
  approveAiProposal,
  cancelAiProposal,
  executeAiChat,
  fetchAiProposal,
  setAiChatHttpClientForTesting,
} from '../../src/api/aiChatApi.js';
import type {
  AiActionProposalCard,
  AiActionProposalDecisionResponse,
  AiChatRequest,
  AiChatResponse,
} from '../../src/types/ai-chat.js';

test('executeAiChat posts typed request to chat endpoint and forwards abort signal', async () => {
  const controller = new AbortController();
  const request: AiChatRequest = {
    message: '프로젝트 리스크를 요약해줘',
    locale: 'ko',
    context: {
      kind: 'project',
      teamId: '1',
      teamName: 'Platform Team',
      projectId: '10',
      projectName: 'Alpha Project',
      source: 'route',
      capturedAt: '2026-06-02T00:00:00Z',
      confidence: 'strong',
      scopeRequired: false,
    },
  };
  const response: AiChatResponse = {
    status: 'ANSWER',
    executionId: 'exec-1',
    requiresConfirmation: false,
    confirmationReason: null,
    confirmationCandidates: [],
    context: {
      kind: 'project',
      teamId: '1',
      projectIds: ['10'],
      label: 'Alpha Project',
      toolsUsed: ['issues'],
      caps: { issues: 20 },
    },
    sourceChips: [{ projectName: 'Alpha Project', tool: 'issues', count: 3, projectId: '10' }],
    conclusion: '리스크 3건',
    confirmedFacts: ['지연 이슈 3건'],
    interpretation: '일정 점검이 필요합니다.',
    needsConfirmation: [],
    proposals: [],
    error: null,
    errorState: null,
  };

  const calls: unknown[][] = [];
  const restore = setAiChatHttpClientForTesting({
    get: async (...args: unknown[]) => {
      calls.push(args);
      return { data: response };
    },
    post: async (...args: unknown[]) => {
      calls.push(args);
      return { data: response };
    },
  });

  try {
    const result = await executeAiChat(request, controller.signal);

    assert.deepEqual(result, response);
    assert.equal(AI_CHAT_BASE_PATH, '/ai/chat');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.[0], AI_CHAT_BASE_PATH);
    assert.deepEqual(calls[0]?.[1], request);
    assert.deepEqual(calls[0]?.[2], { signal: controller.signal });
  } finally {
    restore();
  }
});

test('11-W3-04 proposal API helpers use proposal id paths without request bodies', async () => {
  const proposal: AiActionProposalCard = {
    proposalId: 'proposal-1',
    status: 'PENDING',
    executable: true,
    actionType: 'issue.create',
    riskLevel: 'LOW',
    target: { type: 'issue', id: 'ISS-1', label: 'Risk issue', teamId: 1, projectId: 10 },
    title: 'Create issue',
    summary: 'Create a follow-up issue',
    fields: [],
    content: '',
    warnings: [],
    expiresAt: null,
    redactedErrorTitle: null,
    redactedErrorDetail: null,
  };
  const decision: AiActionProposalDecisionResponse = {
    proposal: { ...proposal, status: 'CANCELLED', executable: false },
    decision: 'CANCEL',
    terminal: true,
    message: 'ai.proposal.cancelled',
  };
  const calls: unknown[][] = [];
  const restore = setAiChatHttpClientForTesting({
    get: async (...args: unknown[]) => {
      calls.push(args);
      return { data: proposal };
    },
    post: async (...args: unknown[]) => {
      calls.push(args);
      return { data: decision };
    },
  });

  try {
    assert.deepEqual(await fetchAiProposal('proposal-1'), proposal);
    assert.deepEqual(await approveAiProposal('proposal-1'), decision);
    assert.deepEqual(await cancelAiProposal('proposal-1'), decision);

    assert.equal(AI_PROPOSAL_BASE_PATH, '/ai/proposals');
    assert.equal(calls[0]?.[0], '/ai/proposals/proposal-1');
    assert.equal(calls[1]?.[0], '/ai/proposals/proposal-1/approve');
    assert.equal(calls[1]?.[1], undefined);
    assert.equal(calls[2]?.[0], '/ai/proposals/proposal-1/cancel');
    assert.equal(calls[2]?.[1], undefined);
  } finally {
    restore();
  }
});
