import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {
  clearCodeModeSharedDraft,
  readCodeModeSharedDraftConfirmedBlank,
  readCodeModeSharedDraftIntentionalBlank,
  readCodeModeSharedDraftSnapshot,
  readCodeModeSharedDraftText,
  writeCodeModeSharedDraftTextSnapshot,
} from '../../src/lib/code-mode-shared-draft.js';

test('writeCodeModeSharedDraftTextSnapshot 는 confirmed blank 상태를 함께 저장한다', () => {
  const doc = new Y.Doc();

  writeCodeModeSharedDraftTextSnapshot(doc, '', 'rev-1', true, true, 'test-origin');

  assert.equal(readCodeModeSharedDraftText(doc), '');
  assert.equal(readCodeModeSharedDraftIntentionalBlank(doc), true);
  assert.equal(readCodeModeSharedDraftConfirmedBlank(doc), true);
  assert.deepEqual(readCodeModeSharedDraftSnapshot(doc), {
    text: '',
    baselineRevision: 'rev-1',
    isIntentionalBlank: true,
    isConfirmedBlank: true,
    graph: null,
    updatedAt: readCodeModeSharedDraftSnapshot(doc).updatedAt,
  });
});

test('writeCodeModeSharedDraftTextSnapshot 는 미확정 blank 상태도 구분해 저장한다', () => {
  const doc = new Y.Doc();

  writeCodeModeSharedDraftTextSnapshot(doc, '', 'rev-2', true, false, 'test-origin');

  assert.equal(readCodeModeSharedDraftText(doc), '');
  assert.equal(readCodeModeSharedDraftIntentionalBlank(doc), true);
  assert.equal(readCodeModeSharedDraftConfirmedBlank(doc), false);
});

test('clearCodeModeSharedDraft 는 text/blank 상태를 모두 제거한다', () => {
  const doc = new Y.Doc();

  writeCodeModeSharedDraftTextSnapshot(
    doc,
    "Table '임시' {}",
    'rev-3',
    false,
    false,
    'test-origin',
  );
  clearCodeModeSharedDraft(doc, 'clear-origin');

  assert.deepEqual(readCodeModeSharedDraftSnapshot(doc), {
    text: '',
    baselineRevision: null,
    isIntentionalBlank: false,
    isConfirmedBlank: false,
    graph: null,
    updatedAt: readCodeModeSharedDraftSnapshot(doc).updatedAt,
  });
});

test('draft lookup emits no updates and preserves the later remote text', () => {
  const local = new Y.Doc();
  const remote = new Y.Doc();
  let updates = 0;
  local.on('update', () => updates++);
  const before = Y.encodeStateAsUpdate(local);
  assert.equal(readCodeModeSharedDraftText(local), '');
  assert.equal(readCodeModeSharedDraftSnapshot(local).text, '');
  assert.equal(updates, 0);
  assert.deepEqual(Y.encodeStateAsUpdate(local), before);
  writeCodeModeSharedDraftTextSnapshot(remote, '원격 초안', 'r1', false, false, 'remote');
  Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
  assert.equal(readCodeModeSharedDraftSnapshot(local).text, '원격 초안');
  local.destroy();
  remote.destroy();
});
