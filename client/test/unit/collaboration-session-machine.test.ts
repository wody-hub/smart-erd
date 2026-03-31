import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionCollaborationRuntimeState } from '../../src/collaboration/core/collaboration-session-machine.js';
import { INITIAL_COLLABORATION_RUNTIME_STATE } from '../../src/collaboration/core/collaboration-runtime-types.js';

test('bootstrap-loaded 는 preview 상태를 유지한다', () => {
  assert.equal(
    transitionCollaborationRuntimeState(INITIAL_COLLABORATION_RUNTIME_STATE, 'bootstrap-loaded'),
    'preview',
  );
});

test('ws-connected 는 preview 에서 hydrating 으로 전이한다', () => {
  assert.equal(transitionCollaborationRuntimeState('preview', 'ws-connected'), 'hydrating');
});

test('remote-snapshot-applied 는 live 로 전이한다', () => {
  assert.equal(transitionCollaborationRuntimeState('hydrating', 'remote-snapshot-applied'), 'live');
});

test('fallback-timeout 은 degraded 로 전이한다', () => {
  assert.equal(transitionCollaborationRuntimeState('hydrating', 'fallback-timeout'), 'degraded');
});

test('reconnect-start 는 reconnecting 으로 전이한다', () => {
  assert.equal(transitionCollaborationRuntimeState('degraded', 'reconnect-start'), 'reconnecting');
});

test('destroy 는 초기 preview 상태로 되돌린다', () => {
  assert.equal(transitionCollaborationRuntimeState('live', 'destroy'), INITIAL_COLLABORATION_RUNTIME_STATE);
});
