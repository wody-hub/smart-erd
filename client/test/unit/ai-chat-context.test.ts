import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAiSendContextSnapshot,
  deriveAiRouteContext,
  requiresExplicitAiScope,
} from '../../src/hooks/useAiRouteContext.js';
import type { AiChatContextSnapshot } from '../../src/types/ai-chat.js';

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
