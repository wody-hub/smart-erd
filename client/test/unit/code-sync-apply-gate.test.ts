import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  resolveCodeAutoApplyStatus,
  shouldOpenApplyConfirm,
} from '../../src/lib/code-sync-apply-gate.js';

test('resolveCodeAutoApplyStatus 는 성공 시 synced 를 반환한다', () => {
  assert.equal(resolveCodeAutoApplyStatus(true), 'synced');
});

test('resolveCodeAutoApplyStatus 는 실패 시 hold-manual-confirm 를 반환한다', () => {
  assert.equal(resolveCodeAutoApplyStatus(false), 'hold-manual-confirm');
});

test('shouldOpenApplyConfirm 는 기존 노드가 있으면 true 를 반환한다', () => {
  assert.equal(shouldOpenApplyConfirm(1, false), true);
});

test('shouldOpenApplyConfirm 는 노드가 없어도 대형 다이어그램이면 true 를 반환한다', () => {
  assert.equal(shouldOpenApplyConfirm(0, true), true);
});

test('shouldOpenApplyConfirm 는 소형 + 빈 캔버스에서 false 를 반환한다', () => {
  assert.equal(shouldOpenApplyConfirm(0, false), false);
});
