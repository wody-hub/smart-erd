import assert from 'node:assert/strict';
import test from 'node:test';
import { ROUTES } from '../../src/constants/routes.js';
import {
  AI_CHAT_PROTECTED_ROUTE_PATTERNS,
  isAiChatShellRouteCovered,
} from '../../src/components/ai/AuthenticatedAiChatShell.js';
import {
  buildAiChatDrawerViewModel,
  type AiChatDrawerViewModelInput,
} from '../../src/components/ai/AiChatDrawer.js';
import { buildAiChatTriggerPresentation } from '../../src/components/ai/AiChatTrigger.js';
import type {
  AiChatConfirmationCandidate,
  AiChatContextSnapshot,
  AiChatMessage,
} from '../../src/types/ai-chat.js';

const projectContext: AiChatContextSnapshot = {
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

function drawerInput(
  overrides: Partial<AiChatDrawerViewModelInput> = {},
): AiChatDrawerViewModelInput {
  return {
    messages: [],
    routeContext: projectContext,
    selectedContext: null,
    confirmationCandidates: [],
    providerAvailability: 'AVAILABLE',
    isRunning: false,
    ...overrides,
  };
}

test('10-W0-07 trigger presentation uses localized AI drawer copy and active state', () => {
  assert.deepEqual(buildAiChatTriggerPresentation(false), {
    labelKey: 'aiChat.drawer.triggerLabel',
    ariaLabelKey: 'aiChat.aria.trigger',
    isActive: false,
  });
  assert.equal(buildAiChatTriggerPresentation(true).isActive, true);
});

test('10-W0-07 drawer view model preserves transcript and blocks weak context sends', () => {
  const message: AiChatMessage = {
    id: 'message-1',
    role: 'assistant',
    content: 'Alpha Project answer',
    createdAt: '2026-06-02T00:00:00Z',
    context: projectContext,
  };
  const weakContext: AiChatContextSnapshot = {
    kind: 'weak',
    teamId: null,
    teamName: null,
    projectId: null,
    projectName: null,
    source: 'required',
    capturedAt: '2026-06-02T00:00:00Z',
    confidence: 'weak',
    scopeRequired: true,
  };

  const model = buildAiChatDrawerViewModel(
    drawerInput({
      messages: [message],
      routeContext: weakContext,
    }),
  );

  assert.equal(model.titleKey, 'aiChat.drawer.title');
  assert.equal(model.hasMessages, true);
  assert.equal(model.contextRequired, true);
  assert.equal(model.activeContext.kind, 'weak');
  assert.equal(model.canStartNewConversation, true);
  assert.equal(model.canSend, false);
});

test('10-W0-07 drawer model exposes backend confirmation candidates without clearing messages', () => {
  const candidate: AiChatConfirmationCandidate = {
    id: 'project-20',
    label: 'Beta Project',
    kind: 'project',
    teamId: '1',
    teamName: 'Platform Team',
    projectId: '20',
    projectName: 'Beta Project',
    reason: 'ambiguous-name',
  };

  const model = buildAiChatDrawerViewModel(
    drawerInput({
      messages: [
        {
          id: 'message-1',
          role: 'assistant',
          content: '프로젝트를 선택하세요',
          createdAt: '2026-06-02T00:00:00Z',
          context: projectContext,
        },
      ],
      selectedContext: projectContext,
      confirmationCandidates: [candidate],
    }),
  );

  assert.equal(model.confirmationCandidateCount, 1);
  assert.equal(model.hasMessages, true);
  assert.equal(model.activeContext.projectName, 'Alpha Project');
});

test('10-W0-07 authenticated shell covers every protected route pattern from App', () => {
  const protectedRoutes = [
    ROUTES.TEAMS,
    ROUTES.PROJECTS_PATTERN,
    ROUTES.DICTIONARY_PATTERN,
    ROUTES.DIAGRAMS_PATTERN,
    ROUTES.PROJECT_WBS_PATTERN,
    ROUTES.DIAGRAM_PATTERN,
  ];

  assert.deepEqual(AI_CHAT_PROTECTED_ROUTE_PATTERNS, protectedRoutes);
  for (const route of protectedRoutes) {
    assert.equal(isAiChatShellRouteCovered(route), true, `${route} must have shell opener`);
  }

  assert.equal(isAiChatShellRouteCovered(ROUTES.LOGIN), false);
  assert.equal(isAiChatShellRouteCovered(ROUTES.SIGNUP), false);
  assert.equal(isAiChatShellRouteCovered(ROUTES.GUIDE), false);
  assert.equal(isAiChatShellRouteCovered(ROUTES.SETTINGS), false);
});
