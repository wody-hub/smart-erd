import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  DEFAULT_SYNC_POLICY,
  buildSyncPolicyStorageKey,
  getAutoApplyBlockReason,
  loadSyncPolicy,
  resolveLayoutMode,
} from '../../src/lib/sync-policy.js';

test('buildSyncPolicyStorageKey 는 팀/프로젝트/다이어그램 스코프를 키로 조합한다', () => {
  const key = buildSyncPolicyStorageKey({
    teamId: '2',
    projectId: '7',
    diagramId: '42',
  });
  assert.equal(key, 'smart-erd-sync-policy:2:7:42');
});

test('buildSyncPolicyStorageKey 는 스코프 누락 시 null을 반환한다', () => {
  const key = buildSyncPolicyStorageKey({
    teamId: '2',
    projectId: '7',
  });
  assert.equal(key, null);
});

test('resolveLayoutMode 는 대형 구간에서 full 요청을 incremental로 낮춘다', () => {
  const mode = resolveLayoutMode('full', 300, 300);
  assert.equal(mode, 'incremental');
});

test('resolveLayoutMode 는 임계치 미만에서 요청 모드를 그대로 유지한다', () => {
  const mode = resolveLayoutMode('none', 120, 300);
  assert.equal(mode, 'none');
});

test('getAutoApplyBlockReason 는 autoApplyEnabled=false 일 때 즉시 차단한다', () => {
  const reason = getAutoApplyBlockReason(
    {
      ...DEFAULT_SYNC_POLICY,
      autoApplyEnabled: false,
    },
    20,
  );
  assert.equal(reason, 'auto-apply-disabled');
});

test('getAutoApplyBlockReason 는 대형 임계치 이상에서 차단한다', () => {
  const reason = getAutoApplyBlockReason(
    {
      ...DEFAULT_SYNC_POLICY,
      largeDiagramThreshold: 300,
    },
    301,
  );
  assert.equal(reason, 'large-diagram');
});

test('loadSyncPolicy 는 브라우저 환경이 아니면 기본값을 반환한다', () => {
  const policy = loadSyncPolicy({
    teamId: '2',
    projectId: '7',
    diagramId: '42',
  });
  assert.deepEqual(policy, DEFAULT_SYNC_POLICY);
});
