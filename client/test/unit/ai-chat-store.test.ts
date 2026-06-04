import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AiActionProposalCard,
  AiChatMessage,
  AiChatResponse,
} from '../../src/types/ai-chat.js';
import {
  appendAiChatMessage,
  buildAiChatConversationStorageKey,
  clearAiChatConversation,
  closeAiChatDrawer,
  createAiChatStorageKey,
  createInitialAiChatState,
  deserializeAiChatConversation,
  hydrateAiChatConversationForLogin,
  loadAiChatConversation,
  openAiChatDrawer,
  saveAiChatConversation,
  serializeAiChatConversation,
  sanitizeAiActionProposalCard,
  startNewAiChatConversation,
  updateProposalInAiChatMessage,
} from '../../src/stores/useAiChatStore.js';

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
  };
}

function message(id: string, content = `message-${id}`): AiChatMessage {
  return {
    id,
    role: 'user',
    content,
    createdAt: `2026-06-02T00:00:${id.padStart(2, '0')}Z`,
    context: null,
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
    fields: [{ label: 'Title', beforeValue: null, afterValue: 'Follow-up', changeType: 'ADD' }],
    content: 'Follow-up content',
    warnings: [],
    expiresAt: null,
    redactedErrorTitle: null,
    redactedErrorDetail: null,
  };
}

test('10-W0-04 drawer open state survives message operations and explicit close', () => {
  const opened = openAiChatDrawer(createInitialAiChatState());
  const withMessage = appendAiChatMessage(opened, message('1'));
  const closed = closeAiChatDrawer(withMessage);

  assert.equal(opened.isOpen, true);
  assert.equal(withMessage.isOpen, true);
  assert.equal(closed.isOpen, false);
  assert.equal(withMessage.messages.length, 1);
});

test('10-W0-04 storage key is isolated by authenticated login id', () => {
  assert.equal(
    buildAiChatConversationStorageKey('tester@example.com'),
    'smart-erd-ai-chat-conversation:tester@example.com',
  );
  assert.equal(
    createAiChatStorageKey('tester@example.com'),
    buildAiChatConversationStorageKey('tester@example.com'),
  );
  assert.notEqual(
    buildAiChatConversationStorageKey('tester@example.com'),
    buildAiChatConversationStorageKey('other@example.com'),
  );
  assert.equal(buildAiChatConversationStorageKey(null), null);
});

test('10-W0-04 serializes drawer presentation state without running execution state', () => {
  const response: AiChatResponse = {
    status: 'NEEDS_CONFIRMATION',
    conclusion: '',
    interpretation: '',
    confirmedFacts: [],
    needsConfirmation: ['프로젝트 범위를 선택하세요'],
    sourceChips: [],
    proposals: [],
    confirmationCandidates: [
      {
        id: 'project-10',
        label: 'Alpha Project',
        kind: 'project',
        teamId: '1',
        projectId: '10',
        reason: 'exact',
      },
    ],
    error: null,
  };
  const state = {
    ...openAiChatDrawer(createInitialAiChatState()),
    messages: [
      {
        ...message('1'),
        role: 'assistant' as const,
        content: '확인이 필요합니다',
        response,
      },
    ],
    selectedContext: {
      kind: 'project' as const,
      teamId: '1',
      teamName: 'Platform Team',
      projectId: '10',
      projectName: 'Alpha Project',
      source: 'manual' as const,
      capturedAt: '2026-06-02T00:00:00Z',
    },
    confirmationCandidates: response.confirmationCandidates,
    runningExecutionId: 'exec-running',
  };

  const serialized = serializeAiChatConversation(state);
  const restored = deserializeAiChatConversation(serialized);

  assert.equal(serialized.includes('exec-running'), false);
  assert.equal(restored.isOpen, true);
  assert.equal(restored.messages[0]?.response?.confirmationCandidates?.[0]?.projectId, '10');
  assert.equal(restored.selectedContext?.projectName, 'Alpha Project');
  assert.equal(restored.confirmationCandidates.length, 1);
  assert.equal(restored.runningExecutionId, null);
});

test('11-W3-04 proposal terminal state updates inside the original assistant message', () => {
  const assistant: AiChatMessage = {
    ...message('assistant', 'Create a follow-up issue'),
    role: 'assistant',
    response: {
      status: 'ANSWER',
      conclusion: '리스크 1건',
      interpretation: '후속 이슈가 필요합니다.',
      confirmedFacts: ['지연 이슈 1건'],
      needsConfirmation: [],
      sourceChips: [],
      proposals: [proposal('PENDING')],
    },
  };
  const state = appendAiChatMessage(createInitialAiChatState(), assistant);
  const updated = updateProposalInAiChatMessage(state, 'assistant', proposal('EXECUTED'));

  assert.equal(updated.messages.length, 1);
  assert.equal(updated.messages[0]?.response?.proposals[0]?.status, 'EXECUTED');
});

test('11-W3-04 proposal storage keeps sanitized terminal cards across hydration', () => {
  const { storage } = createStorage();
  const state = appendAiChatMessage(createInitialAiChatState(), {
    ...message('assistant', 'Create a follow-up issue'),
    role: 'assistant',
    response: {
      status: 'ANSWER',
      conclusion: '리스크 1건',
      interpretation: '후속 이슈가 필요합니다.',
      confirmedFacts: ['지연 이슈 1건'],
      needsConfirmation: [],
      sourceChips: [],
      proposals: [proposal('CANCELLED')],
    },
  });

  saveAiChatConversation('tester', state, storage);
  const restored = hydrateAiChatConversationForLogin(createInitialAiChatState(), 'tester', storage);

  assert.equal(restored.messages[0]?.response?.proposals[0]?.status, 'CANCELLED');
  assert.equal(restored.messages[0]?.response?.proposals[0]?.proposalId, 'proposal-1');
});

test('10-W0-04 preserves numeric backend confirmation candidate ids in presentation state', () => {
  const state = {
    ...openAiChatDrawer(createInitialAiChatState()),
    confirmationCandidates: [
      {
        id: 'project-10',
        label: 'Alpha Project',
        kind: 'project' as const,
        teamId: 1,
        projectId: 10,
        projectName: 'Alpha Project',
        reason: 'exact-name',
      },
    ],
  };

  const restored = deserializeAiChatConversation(serializeAiChatConversation(state));

  assert.equal(restored.confirmationCandidates[0]?.teamId, 1);
  assert.equal(restored.confirmationCandidates[0]?.projectId, 10);
});

test('10-W0-04 conversation persists by login and resets only through new conversation', () => {
  const { storage } = createStorage();
  const initial = openAiChatDrawer(createInitialAiChatState());
  const withMessages = appendAiChatMessage(initial, message('1'));

  saveAiChatConversation('tester', withMessages.messages, storage);
  assert.deepEqual(loadAiChatConversation('tester', storage), withMessages.messages);
  assert.deepEqual(loadAiChatConversation('other', storage), []);

  const reset = startNewAiChatConversation(withMessages);
  saveAiChatConversation('tester', reset.messages, storage);

  assert.deepEqual(loadAiChatConversation('tester', storage), []);
});

test('10-W0-04 switching authenticated users hydrates the matching namespace only', () => {
  const { storage } = createStorage();
  const loginAState = appendAiChatMessage(
    openAiChatDrawer(createInitialAiChatState()),
    message('1', 'login-a'),
  );
  const loginBState = appendAiChatMessage(
    openAiChatDrawer(createInitialAiChatState()),
    message('2', 'login-b'),
  );

  saveAiChatConversation('loginA', loginAState, storage);
  saveAiChatConversation('loginB', loginBState, storage);

  const hydratedB = hydrateAiChatConversationForLogin(loginAState, 'loginB', storage);
  const hydratedMissing = hydrateAiChatConversationForLogin(loginBState, 'loginC', storage);

  assert.equal(hydratedB.messages.length, 1);
  assert.equal(hydratedB.messages[0]?.content, 'login-b');
  assert.equal(hydratedMissing.messages.length, 0);
  assert.equal(hydratedMissing.runningExecutionId, null);
});

test('10-W0-04 logout clearing removes only the current user conversation', () => {
  const { storage } = createStorage();
  saveAiChatConversation('tester', [message('1')], storage);
  saveAiChatConversation('other', [message('2')], storage);

  clearAiChatConversation('tester', storage);

  assert.deepEqual(loadAiChatConversation('tester', storage), []);
  assert.equal(loadAiChatConversation('other', storage).length, 1);
});

test('10-W0-04 persisted rendered messages are capped to the most recent 50', () => {
  const { storage } = createStorage();
  const messages = Array.from({ length: 75 }, (_, index) => message(String(index + 1)));

  saveAiChatConversation('tester', messages, storage);

  const saved = loadAiChatConversation('tester', storage);
  assert.equal(saved.length, 50);
  assert.equal(saved[0]?.id, '26');
  assert.equal(saved[49]?.id, '75');
});

test('10-W0-04 local persistence rejects secret and raw context shaped fields', () => {
  const { values, storage } = createStorage();
  const unsafe = {
    ...message('1'),
    accessToken: 'token',
    refreshToken: 'refresh',
    cookie: 'session',
    password: 'secret',
    rawPrompt: 'prompt',
    rawContext: { teamId: 1 },
    rawProviderOutput: { answer: 'raw' },
    env: { HOME: '/tmp' },
    toolPayload: { sql: 'select 1' },
  } as unknown as AiChatMessage;

  saveAiChatConversation('tester', [unsafe], storage);

  const serialized = values.get('smart-erd-ai-chat-conversation:tester') ?? '';
  for (const forbidden of [
    'accessToken',
    'refreshToken',
    'cookie',
    'password',
    'rawPrompt',
    'rawContext',
    'rawProviderOutput',
    'env',
    'toolPayload',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not be persisted`);
  }
});

test('11-W3-04 proposal sanitizer strips unrecognized nested fields before persistence', () => {
  const unsafe = {
    ...proposal(),
    payload: { value: 'hidden' },
    rawPrompt: 'hidden',
    rawContext: 'hidden',
    rawProviderOutput: 'hidden',
    stdout: 'hidden',
    stderr: 'hidden',
    accessToken: 'hidden',
    refreshToken: 'hidden',
    cookie: 'hidden',
    password: 'hidden',
    env: 'hidden',
    toolPayload: 'hidden',
  } as unknown as AiActionProposalCard;

  const sanitized = sanitizeAiActionProposalCard(unsafe);

  assert.equal(sanitized?.proposalId, 'proposal-1');
  const serialized = JSON.stringify(sanitized);
  for (const forbidden of [
    'payload',
    'rawPrompt',
    'rawContext',
    'rawProviderOutput',
    'stdout',
    'stderr',
    'accessToken',
    'refreshToken',
    'cookie',
    'password',
    'env',
    'toolPayload',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not be persisted`);
  }
});
