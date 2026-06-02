import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAiSendContextSnapshot,
  deriveAiRouteContext,
  requiresExplicitAiScope,
} from '../../src/hooks/useAiRouteContext.js';
import {
  buildAiChatContextOptions,
  createAiChatContextFromOption,
  createAiChatContextOptionQueryKeys,
} from '../../src/hooks/useAiChatContextOptions.js';
import { buildAiChatContextBarViewModel } from '../../src/components/ai/AiChatContextBar.js';
import { resolveAiChatComposerState } from '../../src/components/ai/AiChatComposer.js';
import type { AiChatConfirmationCandidate, AiChatContextSnapshot } from '../../src/types/ai-chat.js';

test('10-W0-05 derives team and project scope from project routes', () => {
  const context = deriveAiRouteContext({
    pathname: '/teams/1/projects/10/diagrams',
    teamName: 'Platform Team',
    projectName: 'Alpha Project',
  });

  assert.equal(context.kind, 'project');
  assert.equal(context.teamId, '1');
  assert.equal(context.projectId, '10');
  assert.equal(context.source, 'route');
});

test('10-W0-05 applies manual context override without route rewriting it', () => {
  const manual: AiChatContextSnapshot = {
    kind: 'project',
    teamId: '1',
    teamName: 'Platform Team',
    projectId: '20',
    projectName: 'Manual Project',
    source: 'manual',
    capturedAt: '2026-06-02T00:00:00Z',
  };

  const context = deriveAiRouteContext({
    pathname: '/teams/1/projects/10/diagrams',
    teamName: 'Platform Team',
    projectName: 'Alpha Project',
    manualContext: manual,
  });

  assert.deepEqual(context, manual);
});

test('10-W0-05 weak context requires explicit scope before project-data questions', () => {
  const context = deriveAiRouteContext({ pathname: '/teams' });

  assert.equal(context.kind, 'weak');
  assert.equal(requiresExplicitAiScope(context), true);
});

test('10-W0-05 current team multi-project mode is available without all-team scope', () => {
  const context = deriveAiRouteContext({
    pathname: '/teams/1/projects',
    teamName: 'Platform Team',
  });

  assert.equal(context.kind, 'team');
  assert.equal(context.teamId, '1');
  assert.equal(context.projectId, null);
  assert.equal(requiresExplicitAiScope(context), false);
});

test('10-W0-05 send-time context snapshot is not mutated by later route changes', () => {
  const routeContext = deriveAiRouteContext({
    pathname: '/teams/1/projects/10/diagrams',
    teamName: 'Platform Team',
    projectName: 'Alpha Project',
  });
  const snapshot = createAiSendContextSnapshot(routeContext);
  const nextRouteContext = deriveAiRouteContext({
    pathname: '/teams/1/projects/20/diagrams',
    teamName: 'Platform Team',
    projectName: 'Beta Project',
  });

  assert.equal(snapshot.projectId, '10');
  assert.equal(nextRouteContext.projectId, '20');
});

test('10-W0-05 authorized teams projects and confirmation candidates become context options', () => {
  const candidate: AiChatConfirmationCandidate = {
    id: 'candidate-project-20',
    label: 'Beta Project',
    kind: 'project',
    teamId: '1',
    teamName: 'Platform Team',
    projectId: '20',
    projectName: 'Beta Project',
    reason: 'ambiguous-name',
  };
  const options = buildAiChatContextOptions({
    teams: [
      {
        id: 1,
        name: 'Platform Team',
        ownerName: 'Owner',
        memberCount: 3,
        createdAt: '2026-06-02T00:00:00Z',
      },
    ],
    projects: [
      {
        id: 10,
        name: 'Alpha Project',
        description: null,
        teamId: 1,
        createdAt: '2026-06-02T00:00:00Z',
      },
    ],
    confirmationCandidates: [candidate],
  });

  assert.deepEqual(createAiChatContextOptionQueryKeys('1'), {
    teams: ['teams'],
    projects: ['teams', '1', 'projects'],
  });
  assert.deepEqual(
    options.map((option) => [option.kind, option.label, option.source]),
    [
      ['team', 'Platform Team', 'authorized'],
      ['project', 'Alpha Project', 'authorized'],
      ['project', 'Beta Project', 'confirmation'],
    ],
  );
  assert.equal(JSON.stringify(options).includes('rawProviderOutput'), false);
  assert.equal(JSON.stringify(options).includes('wbs'), false);

  const context = createAiChatContextFromOption(options[1]!, () => '2026-06-02T00:00:00Z');
  assert.equal(context.source, 'manual');
  assert.equal(context.teamId, 1);
  assert.equal(context.projectId, 10);
  assert.equal(context.projectName, 'Alpha Project');
});

test('10-W0-05 context bar model distinguishes route manual weak and candidate states', () => {
  const weak = deriveAiRouteContext({ pathname: '/teams' });
  const manual = createAiChatContextFromOption(
    {
      id: 'project-10',
      label: 'Alpha Project',
      kind: 'project',
      teamId: '1',
      teamName: 'Platform Team',
      projectId: '10',
      projectName: 'Alpha Project',
      source: 'authorized',
    },
    () => '2026-06-02T00:00:00Z',
  );
  const model = buildAiChatContextBarViewModel({
    currentContext: weak,
    selectedContext: manual,
    confirmationCandidates: [
      {
        id: 'candidate-project-20',
        label: 'Beta Project',
        kind: 'project',
        teamId: '1',
        teamName: 'Platform Team',
        projectId: '20',
        projectName: 'Beta Project',
      },
    ],
    options: [],
  });

  assert.equal(model.currentLabel, 'Alpha Project');
  assert.equal(model.stateKey, 'aiChat.context.manual');
  assert.equal(model.requiresSelection, false);
  assert.equal(model.confirmationOptions.length, 1);
});

test('10-W0-05 composer state disables send and exposes stop waiting during execution', () => {
  assert.deepEqual(
    resolveAiChatComposerState({
      message: '   ',
      providerAvailability: 'AVAILABLE',
      contextRequired: false,
      canSend: false,
      isRunning: false,
    }),
    {
      sendDisabled: true,
      showStopWaiting: false,
      buttonLabelKey: 'aiChat.composer.send',
      statusKey: 'aiChat.composer.disabled.empty',
    },
  );
  assert.deepEqual(
    resolveAiChatComposerState({
      message: '리스크를 요약해줘',
      providerAvailability: 'AVAILABLE',
      contextRequired: false,
      canSend: false,
      isRunning: true,
    }),
    {
      sendDisabled: true,
      showStopWaiting: true,
      buttonLabelKey: 'aiChat.composer.stopWaiting',
      statusKey: 'aiChat.composer.running',
    },
  );
});
