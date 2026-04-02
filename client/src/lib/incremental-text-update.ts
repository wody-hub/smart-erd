import { diff_match_patch, DIFF_EQUAL, DIFF_INSERT, DIFF_DELETE } from 'diff-match-patch';
import type * as Y from 'yjs';

/**
 * 이전/현재 텍스트 diff를 Y.Text 증분 연산으로 적용한다.
 *
 * IMPORTANT: 반드시 Y.Doc.transact() 내부에서 호출해야 한다.
 * 외부에서 transact로 감싸지 않으면 중간 상태가 원격에 전파된다.
 *
 * @param yText  대상 Y.Text
 * @param prevText 이전 텍스트
 * @param nextText 변경된 텍스트
 */
export function applyIncrementalTextUpdate(
  yText: Y.Text,
  prevText: string,
  nextText: string,
): void {
  if (prevText === nextText) {
    return;
  }

  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(prevText, nextText);
  dmp.diff_cleanupSemantic(diffs);

  let cursor = 0;
  for (const [op, text] of diffs) {
    if (op === DIFF_EQUAL) {
      cursor += text.length;
    } else if (op === DIFF_DELETE) {
      yText.delete(cursor, text.length);
      // delete 후 cursor 이동 없음 (삭제된 만큼 offset이 당겨짐)
    } else if (op === DIFF_INSERT) {
      yText.insert(cursor, text);
      cursor += text.length;
    }
  }
}
