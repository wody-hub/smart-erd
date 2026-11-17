import type { editor, IRange } from 'monaco-editor';
import type { DslProjection, TableBlock } from './dsl-block-projection.js';

/** 모델·배치·마커에서 공유하는 소유자 이름. */
export const CODE_BLOCK_MARKER_OWNER = 'erd-unified-block-edit';

/**
 * dirty 블록의 텍스트와 상대 ID 범위를 유지하며 전체 표시 좌표를 다시 계산한다.
 * @param blocks 표시할 블록(안정 ID 순서)
 * @param revision 표시 투영 버전
 * @returns LF 텍스트와 일관된 절대 범위
 */
export function layoutEditableProjection(blocks: TableBlock[], revision: number): DslProjection {
  const text = blocks.map((block) => block.text).join('\n');
  let start = 0;
  const lineStarts = [0];
  for (let index = 0; index < text.length; index++)
    if (text[index] === '\n') lineStarts.push(index + 1);
  /**
   * 누적 줄 시작점의 이진 탐색으로 반복적인 전체 prefix 문자열 생성을 피한다.
   * @param offset UTF-16 오프셋
   * @returns 1부터 시작하는 행·열
   */
  const positionAt = (offset: number) => {
    let low = 0,
      high = lineStarts.length;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (lineStarts[mid] <= offset) low = mid;
      else high = mid;
    }
    return { line: low + 1, column: offset - lineStarts[low] + 1 };
  };
  /**
   * 문자열 오프셋을 Monaco 행·열 범위로 변환한다.
   * @param from 시작 오프셋
   * @param to 끝 오프셋
   * @returns LF 기준 범위
   */
  const rangeAt = (from: number, to: number) => {
    const before = positionAt(from),
      after = positionAt(to);
    return {
      start: from,
      end: to,
      startLine: before.line,
      startColumn: before.column,
      endLine: after.line,
      endColumn: after.column,
    };
  };
  return {
    text,
    revision,
    blocks: blocks.map((block) => {
      const offset = start;
      start += block.text.length + 1;
      return {
        ...block,
        tableRange: rangeAt(offset, offset + block.text.length),
        columnRanges: block.columnRanges.map((column) => ({
          ...column,
          ...rangeAt(
            offset + column.start - block.tableRange.start,
            offset + column.end - block.tableRange.start,
          ),
        })),
      };
    }),
  };
}

/**
 * 텍스트 이력과 원격 선택을 최소 범위 비기록 편집으로 적용한다.
 * @param model 편집 전용 모델
 * @param range 현재 decoration 범위
 * @param text 대체 블록 텍스트
 * @returns 적용 여부
 */
export function replaceEditableBlock(
  model: editor.ITextModel,
  range: IRange,
  text: string,
): boolean {
  const before = model.getValueInRange(range);
  if (before === text) return false;
  let prefix = 0,
    suffix = 0;
  while (prefix < before.length && prefix < text.length && before[prefix] === text[prefix])
    prefix++;
  while (
    suffix < before.length - prefix &&
    suffix < text.length - prefix &&
    before[before.length - suffix - 1] === text[text.length - suffix - 1]
  )
    suffix++;
  const start = model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
  const from = model.getPositionAt(start + prefix),
    to = model.getPositionAt(start + before.length - suffix);
  model.applyEdits([
    {
      range: {
        startLineNumber: from.lineNumber,
        startColumn: from.column,
        endLineNumber: to.lineNumber,
        endColumn: to.column,
      },
      text: text.slice(prefix, text.length - suffix),
      forceMoveMarkers: true,
    },
  ]);
  return true;
}

/** 한 블록 내부 변경만 읽고, 경계 변경은 전체 구조 검사로 넘긴다. */
export function readEditableBlockChange(
  model: Pick<editor.ITextModel, 'getDecorationsInRange' | 'getOffsetAt' | 'getValueInRange'>,
  event: editor.IModelContentChangedEvent,
  tableIds: ReadonlyMap<string, string>,
): { tableId: string; text: string; multiline: boolean } | undefined {
  if (!event.changes.length) return;
  const changes = [...event.changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
  const change = changes[0];
  const point = {
    ...change.range,
    endLineNumber: change.range.startLineNumber,
    endColumn: change.range.startColumn,
  };
  for (const decoration of model.getDecorationsInRange(point)) {
    const tableId = tableIds.get(decoration.options.className ?? '');
    if (!tableId) continue;
    const start = model.getOffsetAt({
      lineNumber: decoration.range.startLineNumber,
      column: decoration.range.startColumn,
    });
    const end = model.getOffsetAt({
      lineNumber: decoration.range.endLineNumber,
      column: decoration.range.endColumn,
    });
    let shift = 0;
    const contained = changes.every((item) => {
      const from = item.rangeOffset + shift;
      const to = from + item.text.length;
      shift += item.text.length - item.rangeLength;
      return from > start && to < end;
    });
    const oldEnd = end - shift;
    // 블록 첫/끝 경계와 구분자 변경은 기존의 전체 구조 검증으로 처리한다.
    if (
      !contained ||
      changes.some(
        (item) => item.rangeOffset <= start || item.rangeOffset + item.rangeLength >= oldEnd,
      )
    )
      continue;
    return {
      tableId,
      text: model.getValueInRange(decoration.range),
      multiline: changes.some(
        (item) =>
          item.range.startLineNumber !== item.range.endLineNumber || item.text.includes('\n'),
      ),
    };
  }
}
