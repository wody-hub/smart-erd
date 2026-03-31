import type { DslPhysicalNameHint } from './dsl-parser.js';

/** DSL 복사용 선택 범위 */
export interface DslCopySelectionRange {
  /** 1-based 시작 행 번호 */
  startLineNumber: number;
  /** 1-based 시작 열 번호 */
  startColumn: number;
  /** 1-based 끝 행 번호 */
  endLineNumber: number;
  /** 1-based 끝 열 번호 (Monaco selection 기준) */
  endColumn: number;
}

/**
 * DSL 문자열에서 사용 중인 줄바꿈 문자를 감지한다.
 *
 * @param dslText 원본 DSL 문자열
 * @returns 복사 결과에 사용할 줄바꿈 문자
 */
function detectDslEol(dslText: string): string {
  return dslText.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * 복사 범위가 비어 있는지 판정한다.
 *
 * @param selection 선택 범위
 * @returns 비어 있는 selection 여부
 */
function isEmptySelection(selection: DslCopySelectionRange): boolean {
  return (
    selection.startLineNumber === selection.endLineNumber &&
    selection.startColumn === selection.endColumn
  );
}

/**
 * 선택 범위를 정렬한다.
 *
 * Monaco는 보통 정렬된 selection을 반환하지만, helper 자체는 입력 순서에 의존하지 않도록
 * 시작 위치 기준 오름차순으로 정규화한다.
 *
 * @param selections 선택 범위 목록
 * @returns 정렬된 선택 범위 목록
 */
function sortSelections(selections: readonly DslCopySelectionRange[]): DslCopySelectionRange[] {
  return [...selections].sort((left, right) => {
    if (left.startLineNumber !== right.startLineNumber) {
      return left.startLineNumber - right.startLineNumber;
    }
    if (left.startColumn !== right.startColumn) {
      return left.startColumn - right.startColumn;
    }
    if (left.endLineNumber !== right.endLineNumber) {
      return left.endLineNumber - right.endLineNumber;
    }
    return left.endColumn - right.endColumn;
  });
}

/**
 * DSL 전체 범위를 나타내는 selection을 만든다.
 *
 * @param lines 줄 단위로 분리한 DSL 텍스트
 * @returns 전체 범위 selection
 */
function buildFullDocumentSelection(lines: readonly string[]): DslCopySelectionRange {
  const lastLineIndex = Math.max(lines.length - 1, 0);
  const lastLine = lines[lastLineIndex] ?? '';

  return {
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: lastLineIndex + 1,
    endColumn: lastLine.length + 1,
  };
}

/**
 * 힌트가 현재 선택 범위에 포함되는지 판정한다.
 *
 * 선택 텍스트 추출 자체는 Monaco처럼 endColumn exclusive 로 처리하되, 물리명 힌트는
 * 논리명 끝 anchor 에 붙으므로 `hint.column === endColumn` 인 경우에도 포함한다.
 *
 * @param hint 물리명 힌트
 * @param selection 선택 범위
 * @returns 포함 여부
 */
function isHintInSelection(hint: DslPhysicalNameHint, selection: DslCopySelectionRange): boolean {
  if (hint.line < selection.startLineNumber || hint.line > selection.endLineNumber) {
    return false;
  }

  if (selection.startLineNumber === selection.endLineNumber) {
    return selection.startColumn <= hint.column && hint.column <= selection.endColumn;
  }

  if (hint.line === selection.startLineNumber) {
    return hint.column >= selection.startColumn;
  }

  if (hint.line === selection.endLineNumber) {
    return hint.column <= selection.endColumn;
  }

  return true;
}

/**
 * 선택 범위에 해당하는 줄 문자열 배열을 추출한다.
 *
 * @param lines 줄 단위 DSL 텍스트
 * @param selection 선택 범위
 * @returns selection에 포함된 줄 문자열
 */
function extractSelectionLines(
  lines: readonly string[],
  selection: DslCopySelectionRange,
): string[] {
  const startLineIndex = selection.startLineNumber - 1;
  const endLineIndex = selection.endLineNumber - 1;
  const selectedLines = lines.slice(startLineIndex, endLineIndex + 1);

  return selectedLines.map((line, index) => {
    const currentLineNumber = selection.startLineNumber + index;

    if (selection.startLineNumber === selection.endLineNumber) {
      return line.slice(selection.startColumn - 1, selection.endColumn - 1);
    }

    if (currentLineNumber === selection.startLineNumber) {
      return line.slice(selection.startColumn - 1);
    }

    if (currentLineNumber === selection.endLineNumber) {
      return line.slice(0, selection.endColumn - 1);
    }

    return line;
  });
}

/**
 * 선택 범위 기준 로컬 열 offset을 계산한다.
 *
 * @param selection 선택 범위
 * @param hint 물리명 힌트
 * @returns 로컬 문자열 기준 0-based 삽입 위치
 */
function resolveLocalHintOffset(
  selection: DslCopySelectionRange,
  hint: DslPhysicalNameHint,
): number {
  const lineStartColumn = hint.line === selection.startLineNumber ? selection.startColumn : 1;
  return hint.column - lineStartColumn;
}

/**
 * 선택 범위 한 건의 복사 문자열을 만든다.
 *
 * @param lines 줄 단위 DSL 텍스트
 * @param eol 복사에 사용할 줄바꿈
 * @param selection 선택 범위
 * @param physicalNameHints 화면 표시용 최종 물리명 힌트
 * @returns 선택 범위 복사 문자열
 */
function buildSelectionCopyText(
  lines: readonly string[],
  eol: string,
  selection: DslCopySelectionRange,
  physicalNameHints: readonly DslPhysicalNameHint[],
): string {
  const selectedLines = extractSelectionLines(lines, selection);
  const lineInsertions = new Map<number, Array<{ offset: number; text: string }>>();

  for (const hint of physicalNameHints) {
    if (!isHintInSelection(hint, selection)) {
      continue;
    }

    const lineIndex = hint.line - selection.startLineNumber;
    const currentLine = selectedLines[lineIndex];
    if (currentLine == null) {
      continue;
    }

    const localOffset = resolveLocalHintOffset(selection, hint);
    if (localOffset < 0 || localOffset > currentLine.length) {
      continue;
    }

    const existingInsertions = lineInsertions.get(lineIndex) ?? [];
    existingInsertions.push({
      offset: localOffset,
      text: ` (${hint.physicalName})`,
    });
    lineInsertions.set(lineIndex, existingInsertions);
  }

  for (const [lineIndex, insertions] of lineInsertions) {
    const currentLine = selectedLines[lineIndex];
    if (currentLine == null) {
      continue;
    }

    let nextLine = currentLine;
    for (const insertion of [...insertions].sort((left, right) => right.offset - left.offset)) {
      nextLine =
        nextLine.slice(0, insertion.offset) + insertion.text + nextLine.slice(insertion.offset);
    }
    selectedLines[lineIndex] = nextLine;
  }

  return selectedLines.join(eol);
}

/**
 * DSL 에디터 선택 범위를 기준으로 물리명 포함 복사 문자열을 만든다.
 *
 * 기본 Monaco 복사는 injected text를 포함하지 않으므로, 현재 표시 중인 물리명 힌트를 같은
 * 위치에 다시 삽입한 별도 문자열을 만든다.
 *
 * @param dslText 원본 DSL 문자열
 * @param physicalNameHints 화면 표시용 최종 물리명 힌트
 * @param selections 현재 에디터 선택 범위 목록. 비어 있으면 전체 복사
 * @returns 클립보드에 넣을 문자열
 */
export function buildDslCopyTextWithPhysicalNames(
  dslText: string,
  physicalNameHints: readonly DslPhysicalNameHint[],
  selections: readonly DslCopySelectionRange[] = [],
): string {
  const lines = dslText.split(/\r?\n/);
  const eol = detectDslEol(dslText);
  const effectiveSelections = selections.filter((selection) => !isEmptySelection(selection));

  const normalizedSelections =
    effectiveSelections.length > 0
      ? sortSelections(effectiveSelections)
      : [buildFullDocumentSelection(lines)];

  return normalizedSelections
    .map((selection) => buildSelectionCopyText(lines, eol, selection, physicalNameHints))
    .join(eol);
}
