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

test('동시 최초 초안 입력은 두 탭의 텍스트를 모두 보존한다', () => {
  const a = new Y.Doc();
  const b = new Y.Doc();
  writeCodeModeSharedDraftTextSnapshot(a, 'draft-A', 'r1', false, false, 'a');
  writeCodeModeSharedDraftTextSnapshot(b, 'draft-B', 'r1', false, false, 'b');
  const aUpdate = Y.encodeStateAsUpdate(a);
  const bUpdate = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(a, bUpdate);
  Y.applyUpdate(b, aUpdate);
  assert.equal(readCodeModeSharedDraftText(a), readCodeModeSharedDraftText(b));
  assert.ok(readCodeModeSharedDraftText(a).includes('draft-A'));
  assert.ok(readCodeModeSharedDraftText(a).includes('draft-B'));
  a.destroy();
  b.destroy();
});

test('레거시 중첩 텍스트는 읽을 때 변경하지 않고 첫 쓰기에서 루트로 이관한다', () => {
  const doc = new Y.Doc();
  const legacy = new Y.Text('legacy');
  doc.getMap('codeModeSharedDraft').set('text', legacy);
  const before = Y.encodeStateAsUpdate(doc);
  assert.equal(readCodeModeSharedDraftText(doc), 'legacy');
  assert.deepEqual(Y.encodeStateAsUpdate(doc), before);
  writeCodeModeSharedDraftTextSnapshot(doc, 'edited', 'r1', false, false, 'edit');
  assert.equal(doc.getText('codeModeSharedDraftText').toString(), 'edited');
  assert.equal(legacy.toString(), 'legacy');
  clearCodeModeSharedDraft(doc, 'clear');
  assert.equal(
    readCodeModeSharedDraftText(doc),
    '',
    '이관 이후 레거시 내용이 다시 나타나지 않는다',
  );
  doc.destroy();
});
