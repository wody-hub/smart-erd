import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIncrementalTextUpdate } from '../../src/lib/incremental-text-update.js';
import { buildSectionCommands } from '../../src/collaboration/plugins/markdown/markdown-section-projector.js';
import * as Y from 'yjs';

// --- DOC-01: diff-match-patch -> Y.Text 증분 적용 정확성 ---

test.describe('applyIncrementalTextUpdate', () => {
  test('단순 텍스트 삽입을 Y.Text에 정확히 반영한다', () => {
    const doc = new Y.Doc();
    const yText = doc.getText('test');
    doc.transact(() => {
      yText.insert(0, 'hello');
    });
    doc.transact(() => {
      applyIncrementalTextUpdate(yText, 'hello', 'hello world');
    });
    assert.equal(yText.toString(), 'hello world');
  });

  test('단순 텍스트 삭제를 Y.Text에 정확히 반영한다', () => {
    const doc = new Y.Doc();
    const yText = doc.getText('test');
    doc.transact(() => {
      yText.insert(0, 'hello world');
    });
    doc.transact(() => {
      applyIncrementalTextUpdate(yText, 'hello world', 'hello');
    });
    assert.equal(yText.toString(), 'hello');
  });

  test('동일 텍스트는 Y.Text 연산을 수행하지 않는다', () => {
    const doc = new Y.Doc();
    const yText = doc.getText('test');
    doc.transact(() => {
      yText.insert(0, 'hello');
    });

    let updateCount = 0;
    doc.on('update', () => {
      updateCount++;
    });

    doc.transact(() => {
      applyIncrementalTextUpdate(yText, 'hello', 'hello');
    });

    assert.equal(updateCount, 0, 'Y.Text 연산이 0회여야 한다');
    assert.equal(yText.toString(), 'hello');
  });

  test('prevText와 nextText 다를 때 Y.Text가 nextText와 일치한다', () => {
    const doc = new Y.Doc();
    const yText = doc.getText('test');
    doc.transact(() => {
      yText.insert(0, 'The quick brown fox jumps over the lazy dog');
    });

    const nextText = 'The slow brown cat sits on the lazy mat';
    doc.transact(() => {
      applyIncrementalTextUpdate(yText, 'The quick brown fox jumps over the lazy dog', nextText);
    });
    assert.equal(yText.toString(), nextText);
  });

  test('Y.Doc.transact 내부에서 호출 - 중간 상태가 전파되지 않는다', () => {
    const doc = new Y.Doc();
    const yText = doc.getText('test');
    doc.transact(() => {
      yText.insert(0, 'abc');
    });

    const updates: Uint8Array[] = [];
    doc.on('update', (update: Uint8Array) => {
      updates.push(update);
    });

    doc.transact(() => {
      applyIncrementalTextUpdate(yText, 'abc', 'xyzabc123');
    });

    // transact 내부에서 호출하므로 단일 update 이벤트만 수신되어야 한다
    assert.equal(updates.length, 1, '단일 update 이벤트만 수신되어야 한다');
    assert.equal(yText.toString(), 'xyzabc123');
  });
});

// --- DOC-01: buildSectionCommands - section-aware 커맨드 발행 ---

test.describe('buildSectionCommands', () => {
  test('단일 section 내 변경은 markdown:section-update 커맨드를 발행한다', () => {
    const prevBody = '# A\n\nold text\n\n# B\n\nother';
    const nextBody = '# A\n\nnew text\n\n# B\n\nother';
    const fullBuffer = '---\ntitle: test\n---\n' + nextBody;
    const commands = buildSectionCommands(prevBody, nextBody, fullBuffer);

    assert.equal(commands.length, 1);
    assert.equal(commands[0]!.key, 'markdown:section-update');
    if (commands[0]!.key === 'markdown:section-update') {
      assert.equal(commands[0]!.payload.sectionId, 'a');
      assert.equal(typeof commands[0]!.payload.startOffset, 'number');
      assert.equal(typeof commands[0]!.payload.endOffset, 'number');
      assert.ok(commands[0]!.payload.sectionText.includes('new text'));
    }
  });

  test('heading 추가 변경은 markdown:body-replace fallback을 발행한다', () => {
    const prevBody = '# A\n\ntext';
    const nextBody = '# A\n\ntext\n\n## B\n\nnew section';
    const fullBuffer = nextBody;
    const commands = buildSectionCommands(prevBody, nextBody, fullBuffer);

    assert.equal(commands.length, 1);
    assert.equal(commands[0]!.key, 'markdown:body-replace');
    if (commands[0]!.key === 'markdown:body-replace') {
      assert.equal(commands[0]!.payload.buffer, fullBuffer);
    }
  });

  test('heading 삭제 변경은 markdown:body-replace fallback을 발행한다', () => {
    const prevBody = '# A\n\ntext\n\n# B\n\nother';
    const nextBody = '# A\n\ntext\n\nother';
    const fullBuffer = nextBody;
    const commands = buildSectionCommands(prevBody, nextBody, fullBuffer);

    assert.equal(commands.length, 1);
    assert.equal(commands[0]!.key, 'markdown:body-replace');
  });

  test('section 경계를 넘는 변경은 markdown:body-replace fallback을 발행한다', () => {
    const prevBody = '# A\n\ntext A\n\n# B\n\ntext B';
    // 두 section 모두 변경
    const nextBody = '# A\n\nchanged A\n\n# B\n\nchanged B';
    const fullBuffer = nextBody;
    const commands = buildSectionCommands(prevBody, nextBody, fullBuffer);

    assert.equal(commands.length, 1);
    assert.equal(commands[0]!.key, 'markdown:body-replace');
  });
});
