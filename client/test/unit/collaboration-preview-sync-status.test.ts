import test from 'node:test';
import assert from 'node:assert/strict';
import { toPreviewSyncStatus } from '../../src/collaboration/core/collaboration-preview-sync-status.js';

test('preview 비활성 경로는 항상 inactive 로 축약한다', () => {
  assert.equal(toPreviewSyncStatus('preview', false), 'inactive');
  assert.equal(toPreviewSyncStatus('live', false), 'inactive');
});

test('preview 와 hydrating 은 syncing 으로 축약한다', () => {
  assert.equal(toPreviewSyncStatus('preview', true), 'syncing');
  assert.equal(toPreviewSyncStatus('hydrating', true), 'syncing');
});

test('live 와 degraded 는 그대로 유지한다', () => {
  assert.equal(toPreviewSyncStatus('live', true), 'live');
  assert.equal(toPreviewSyncStatus('degraded', true), 'degraded');
});

test('reconnecting 은 syncing 으로 축약한다', () => {
  assert.equal(toPreviewSyncStatus('reconnecting', true), 'syncing');
});
