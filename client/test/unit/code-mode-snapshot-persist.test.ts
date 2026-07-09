import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_SCHEMA_DRAFT_ORIGIN } from '../../src/lib/shared-schema-draft.js';
import { shouldScheduleCodeModeSnapshotPersist } from '../../src/lib/code-mode-snapshot-persist.js';

test('shouldScheduleCodeModeSnapshotPersist 는 shared schema draft write 를 저장 대상으로 본다', () => {
  assert.equal(shouldScheduleCodeModeSnapshotPersist(SHARED_SCHEMA_DRAFT_ORIGIN), true);
});

test('shouldScheduleCodeModeSnapshotPersist 는 preview drag persisted 위치 반영을 저장 대상으로 본다', () => {
  assert.equal(shouldScheduleCodeModeSnapshotPersist({ type: 'canvas-user-drag' }), true);
});

test('shouldScheduleCodeModeSnapshotPersist 는 자동정렬 persisted 위치 반영을 저장 대상으로 본다', () => {
  assert.equal(shouldScheduleCodeModeSnapshotPersist('canvas-user-layout'), true);
});

test('shouldScheduleCodeModeSnapshotPersist 는 일반 persisted 편집 origin 은 제외한다', () => {
  assert.equal(shouldScheduleCodeModeSnapshotPersist('canvas-user-table'), false);
  assert.equal(shouldScheduleCodeModeSnapshotPersist('canvas-user-column'), false);
  assert.equal(shouldScheduleCodeModeSnapshotPersist('canvas-user-edge'), false);
});

test('shouldScheduleCodeModeSnapshotPersist 는 remote/system/origin 없음 을 제외한다', () => {
  assert.equal(shouldScheduleCodeModeSnapshotPersist('remote'), false);
  assert.equal(shouldScheduleCodeModeSnapshotPersist('canvas-system-dictionary-reconcile'), false);
  assert.equal(shouldScheduleCodeModeSnapshotPersist(null), false);
  assert.equal(shouldScheduleCodeModeSnapshotPersist(undefined), false);
});
