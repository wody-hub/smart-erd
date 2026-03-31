import type { ParsedTableRange } from './ddl-parser.js';

/** 코드 에디터에서 라인번호 클릭으로 이동 가능한 테이블 정보 */
export interface CodeEditorNavigableTable {
  /** 소프트 락/매칭용 테이블 키 */
  tableKey: string;
  /** 테이블 물리명 */
  physicalName: string;
  /** 테이블 논리명 */
  logicalName: string | null;
  /** 테이블 시작 라인 */
  startLine: number;
  /** 테이블 종료 라인 */
  endLine: number;
}

/** 코드 에디터 테이블 포커스 요청 */
export interface CodeEditorTableFocusRequest extends CodeEditorNavigableTable {
  /** 동일 테이블 재요청도 구분하기 위한 request ID */
  requestId: number;
}

/** ERD 테이블에서 코드 줄 reveal 요청 */
export interface CodeEditorTableRevealRequest {
  /** 동일 테이블 재요청도 구분하기 위한 request ID */
  requestId: number;
  /** 소프트 락/매칭용 테이블 키 */
  tableKey?: string | null;
  /** 테이블 물리명 */
  physicalName: string;
  /** 테이블 논리명 */
  logicalName: string | null;
}

interface ParsedSchemaTableLike {
  name: string;
  logicalTableName?: string | null;
  comment?: string | null;
}

/**
 * 파싱된 테이블/라인 범위를 코드 에디터용 이동 대상 목록으로 변환한다.
 *
 * parser가 반환한 테이블과 line range는 같은 순서를 유지한다는 전제에서 zip 한다.
 *
 * @param tables 파싱된 테이블 목록
 * @param tableRanges 파싱된 테이블 라인 범위 목록
 * @returns line gutter navigation 대상 목록
 */
export function buildCodeEditorNavigableTables(
  tables: readonly ParsedSchemaTableLike[],
  tableRanges: readonly ParsedTableRange[],
): CodeEditorNavigableTable[] {
  return tableRanges.flatMap((range, index) => {
    const table = tables[index];
    if (!table) {
      return [];
    }

    return [
      {
        tableKey: range.tableKey,
        physicalName: table.name,
        logicalName: table.logicalTableName?.trim() || table.comment?.trim() || null,
        startLine: range.startLine,
        endLine: range.endLine,
      },
    ];
  });
}

/**
 * 특정 라인에 해당하는 테이블 이동 대상을 찾는다.
 *
 * @param tables 코드 에디터 이동 대상 목록
 * @param lineNumber 1-based 라인 번호
 * @returns 이동 대상 또는 null
 */
export function resolveCodeEditorNavigableTableByLine(
  tables: readonly CodeEditorNavigableTable[],
  lineNumber: number,
): CodeEditorNavigableTable | null {
  for (const table of tables) {
    if (lineNumber >= table.startLine && lineNumber <= table.endLine) {
      return table;
    }
  }
  return null;
}

/**
 * 테이블 reveal 요청과 매칭되는 코드 에디터 테이블 범위를 찾는다.
 *
 * tableKey를 우선 사용하고, 없으면 물리명과 논리명으로 안전하게 매칭한다.
 *
 * @param tables 코드 에디터 이동 대상 목록
 * @param request ERD -> 코드 reveal 요청
 * @returns reveal 대상 또는 null
 */
export function resolveCodeEditorNavigableTableByRequest(
  tables: readonly CodeEditorNavigableTable[],
  request: CodeEditorTableRevealRequest,
): CodeEditorNavigableTable | null {
  if (request.tableKey) {
    const matchedByKey = tables.find((table) => table.tableKey === request.tableKey);
    if (matchedByKey) {
      return matchedByKey;
    }
  }

  const physicalMatches = tables.filter((table) => table.physicalName === request.physicalName);
  if (physicalMatches.length === 1) {
    return physicalMatches[0];
  }

  if (request.logicalName) {
    const exactLogicalMatches = physicalMatches.filter(
      (table) => table.logicalName === request.logicalName,
    );
    if (exactLogicalMatches.length === 1) {
      return exactLogicalMatches[0];
    }

    const logicalMatches = tables.filter((table) => table.logicalName === request.logicalName);
    if (logicalMatches.length === 1) {
      return logicalMatches[0];
    }
  }

  return null;
}
