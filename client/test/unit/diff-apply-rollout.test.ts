import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildRolloutKey,
  loadDiffApplyLocalOverride,
  resolveDiffApplyRollout,
} from '../../src/lib/diff-apply-rollout.js';

test('mode=off 이면 diff apply 를 비활성화한다', () => {
  const decision = resolveDiffApplyRollout({
    mode: 'off',
    betaPercent: '10',
    internalIds: '',
    localOverride: { forceMode: null, internalOptIn: false },
  });
  assert.equal(decision.enabled, false);
  assert.equal(decision.reason, 'mode-off');
});

test('mode=all 이면 diff apply 를 전체 활성화한다', () => {
  const decision = resolveDiffApplyRollout({
    mode: 'all',
    betaPercent: '10',
    internalIds: '',
    localOverride: { forceMode: null, internalOptIn: false },
  });
  assert.equal(decision.enabled, true);
  assert.equal(decision.reason, 'mode-all');
});

test('internal 모드는 allowlist 또는 local opt-in 을 만족할 때만 활성화한다', () => {
  const allowlisted = resolveDiffApplyRollout({
    mode: 'internal',
    betaPercent: '10',
    internalIds: 'alice,bob',
    loginId: 'alice',
    localOverride: { forceMode: null, internalOptIn: false },
  });
  assert.equal(allowlisted.enabled, true);
  assert.equal(allowlisted.reason, 'internal-eligible');

  const optIn = resolveDiffApplyRollout({
    mode: 'internal',
    betaPercent: '10',
    internalIds: '',
    loginId: 'outsider',
    localOverride: { forceMode: null, internalOptIn: true },
  });
  assert.equal(optIn.enabled, true);

  const denied = resolveDiffApplyRollout({
    mode: 'internal',
    betaPercent: '10',
    internalIds: 'alice,bob',
    loginId: 'charlie',
    localOverride: { forceMode: null, internalOptIn: false },
  });
  assert.equal(denied.enabled, false);
  assert.equal(denied.reason, 'internal-not-eligible');
});

test('beta 모드는 stable key 버킷과 percent로 활성화한다', () => {
  const enabled = resolveDiffApplyRollout({
    mode: 'beta',
    betaPercent: 100,
    internalIds: '',
    teamId: '2',
    projectId: '7',
    diagramId: '42',
    loginId: 'alice',
    localOverride: { forceMode: null, internalOptIn: false },
  });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.reason, 'beta-eligible');

  const disabled = resolveDiffApplyRollout({
    mode: 'beta',
    betaPercent: 0,
    internalIds: '',
    teamId: '2',
    projectId: '7',
    diagramId: '42',
    loginId: 'alice',
    localOverride: { forceMode: null, internalOptIn: false },
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.reason, 'beta-not-eligible');
});

test('local forceMode 가 있으면 env mode 보다 우선한다', () => {
  const decision = resolveDiffApplyRollout({
    mode: 'off',
    betaPercent: '10',
    internalIds: '',
    localOverride: { forceMode: 'all', internalOptIn: false },
  });
  assert.equal(decision.enabled, true);
  assert.equal(decision.mode, 'all');
});

test('buildRolloutKey 는 유효한 스코프가 없으면 null 반환한다', () => {
  assert.equal(buildRolloutKey({}), null);
  assert.equal(
    buildRolloutKey({ teamId: '2', projectId: '7', diagramId: '42', loginId: 'alice' }),
    '2:7:42:alice',
  );
});

test('loadDiffApplyLocalOverride 는 localStorage 미지원 환경에서 기본값을 반환한다', () => {
  const original = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = undefined;
  const loaded = loadDiffApplyLocalOverride();
  assert.deepEqual(loaded, { forceMode: null, internalOptIn: false });
  (globalThis as { localStorage?: unknown }).localStorage = original;
});
