import assert from 'node:assert/strict';
import test from 'node:test';
import axiosInstance from '../../src/api/axiosInstance.js';
import { AI_CHAT_BASE_PATH, executeAiChat } from '../../src/api/aiChatApi.js';
import type { AiChatRequest, AiChatResponse } from '../../src/types/ai-chat.js';

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
    error: null,
    errorState: null,
  };

  const originalPost = axiosInstance.post;
  const calls: unknown[][] = [];
  axiosInstance.post = (async (...args: unknown[]) => {
    calls.push(args);
    return { data: response };
  }) as typeof axiosInstance.post;

  try {
    const result = await executeAiChat(request, controller.signal);

    assert.deepEqual(result, response);
    assert.equal(AI_CHAT_BASE_PATH, '/ai/chat');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.[0], AI_CHAT_BASE_PATH);
    assert.deepEqual(calls[0]?.[1], request);
    assert.deepEqual(calls[0]?.[2], { signal: controller.signal });
  } finally {
    axiosInstance.post = originalPost;
  }
});
