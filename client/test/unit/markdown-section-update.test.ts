// Wave 1 스캐폴드 — 구현 모듈은 Plan 02에서 생성됩니다.
// 현재 import 경로가 존재하지 않아 컴파일 오류(RED)가 발생합니다.
// Plan 02 실행 시 import 주석 해제 + 케이스 본문 구현.

import test from 'node:test';
// import assert from 'node:assert/strict';
// import { applyIncrementalTextUpdate } from '../../src/collaboration/yjs/incremental-text-update.js';
// import * as Y from 'yjs';

// --- DOC-01: diff-match-patch → Y.Text 증분 적용 정확성 ---

test.describe('applyIncrementalTextUpdate', () => {
  test.skip('단순 텍스트 삽입을 Y.Text에 정확히 반영한다', () => {
    // prevText: 'hello', nextText: 'hello world'
    // → Y.Text.insert(5, ' world')
  });

  test.skip('단순 텍스트 삭제를 Y.Text에 정확히 반영한다', () => {
    // prevText: 'hello world', nextText: 'hello'
    // → Y.Text.delete(5, 6)
  });

  test.skip('동일 텍스트는 Y.Text 연산을 수행하지 않는다', () => {
    // prevText === nextText → no-op
  });

  test.skip('prevText와 nextText 다를 때 Y.Text가 nextText와 일치한다', () => {
    // diff-match-patch diff 결과의 delete/insert 연산 후 Y.Text.toString() === nextText
  });

  test.skip('Y.Doc.transact 내부에서 호출 — 중간 상태가 전파되지 않는다', () => {
    // doc.transact(() => applyIncrementalTextUpdate(...))
    // 외부 observer 에 단일 update 이벤트만 수신되어야 한다
  });
});

// --- DOC-01: setEditorBuffer — section-aware 커맨드 발행 ---

test.describe('setEditorBuffer — section-aware 커맨드 발행', () => {
  test.skip('단일 section 내 변경은 markdown:section-update 커맨드를 발행한다', () => {
    // 이전 body: '# A\n\nold text\n\n# B\n\nother'
    // 다음 body: '# A\n\nnew text\n\n# B\n\nother'
    // → section-update 커맨드 (sectionId: 'a')
  });

  test.skip('heading 추가 변경은 markdown:body-replace fallback을 발행한다', () => {
    // 이전 body: '# A\n\ntext'
    // 다음 body: '# A\n\ntext\n\n## B\n\nnew section'
    // → body-replace fallback (heading 개수 변화)
  });

  test.skip('heading 삭제 변경은 markdown:body-replace fallback을 발행한다', () => {
    // 이전 body: '# A\n\ntext\n\n# B\n\nother'
    // 다음 body: '# A\n\ntext\n\nother'
    // → body-replace fallback (heading 삭제)
  });

  test.skip('section 경계를 넘는 변경은 markdown:body-replace fallback을 발행한다', () => {
    // 변경이 두 section에 걸치는 경우
    // → body-replace fallback
  });
});
