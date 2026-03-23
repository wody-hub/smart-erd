import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginCodeModeSnapshotKeepalive,
  shouldRetryCodeModeSnapshotAfterKeepalive,
} from '../../src/lib/code-mode-snapshot-keepalive.js';

test('beginCodeModeSnapshotKeepalive 는 최소 간격 이내면 재발사를 막는다', () => {
  const result = beginCodeModeSnapshotKeepalive(1_500, 1_000, 1_000);

  assert.equal(result.shouldSend, false);
  assert.equal(result.nextLastKeepaliveAt, 1_000);
  assert.equal(result.keepalivePending, false);
});

test('beginCodeModeSnapshotKeepalive 는 최소 간격 이후면 keepalive pending 상태를 만든다', () => {
  const result = beginCodeModeSnapshotKeepalive(2_500, 1_000, 1_000);

  assert.equal(result.shouldSend, true);
  assert.equal(result.nextLastKeepaliveAt, 2_500);
  assert.equal(result.keepalivePending, true);
});

test('shouldRetryCodeModeSnapshotAfterKeepalive 는 visible 복귀 시에만 재시도를 허용한다', () => {
  assert.equal(shouldRetryCodeModeSnapshotAfterKeepalive('hidden', true), false);
  assert.equal(shouldRetryCodeModeSnapshotAfterKeepalive('prerender', true), false);
  assert.equal(shouldRetryCodeModeSnapshotAfterKeepalive('visible', false), false);
  assert.equal(shouldRetryCodeModeSnapshotAfterKeepalive('visible', true), true);
});
