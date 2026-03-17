import type {
  DdlParseResult,
  ParsedColumn,
  ParsedRelation,
  ParsedTable,
  ParsedTableRange,
} from './ddl-parser.js';
import {
  resolveLogicalName as resolveLogicalNameFromDictionary,
  type LogicalNameResolverDictionary,
} from './logical-name-resolution.js';
import type { Term, Domain } from '../types/dictionary.js';
import { DSL_TABLE_KEYWORD, DSL_COLUMN_OPTIONS } from './dsl-keywords.js';
import { buildTableLockKey } from './table-lock-key.js';

/** DSL 파싱에 필요한 사전 데이터 */
export interface DslDictionary {
  /** 논리명 → Term 매핑 */
  termByName: Map<string, Term>;
  /** 논리명 → Domain 매핑 */
  domainByName: Map<string, Domain>;
  /** ID → Domain 매핑 */
  domainById: Map<number, Domain>;
  /** 단어사전 매칭 인덱스 */
  wordMatchIndex: LogicalNameResolverDictionary['wordMatchIndex'];
}

/** Monaco 마커용 에러 (위치 정보 포함, i18n 대응) */
export interface DslError {
  /** i18n 키 */
  messageKey: string;
  /** i18n 보간 인자 */
  messageArgs?: Record<string, string>;
  /** 1-based 행 번호 */
  line: number;
  /** 1-based 시작 열 */
  startColumn: number;
  /** 1-based 끝 열 */
  endColumn: number;
  /** 심각도 */
  severity: 'error' | 'warning';
}

/** DSL 파싱 결과 */
export interface DslParseResult {
  /** 기존 DdlParseResult 호환 결과 */
  result: DdlParseResult;
  /** Monaco 마커용 진단 목록 */
  diagnostics: DslError[];
  /** 코드창에 표시할 물리명 힌트 */
  physicalNameHints: DslPhysicalNameHint[];
}

/** DSL 코드창에 물리명을 view hint로 표시하기 위한 메타데이터 */
export interface DslPhysicalNameHint {
  /** 힌트 종류 */
  kind: 'table' | 'column';
  /** 소속 테이블 논리명 (column 힌트일 때만 사용) */
  tableLogicalName?: string;
  /** 1-based 행 번호 */
  line: number;
  /** 1-based 표시 열 */
  column: number;
  /** 논리명 */
  logicalName: string;
  /** 표시할 물리명 */
  physicalName: string;
}

/** Pass 1에서 수집된 테이블 정보 */
interface RawTable {
  /** 테이블 논리명 */
  logicalName: string;
  /** 'Table' 키워드가 있는 행 번호 (1-based) */
  line: number;
  /** 행에서 논리명의 시작 열 (1-based) */
  nameStartCol: number;
  /** 행에서 논리명의 끝 열 (1-based, exclusive) */
  nameEndCol: number;
  /** 수집된 컬럼 목록 */
  columns: RawColumn[];
  /** '}' 종료 행 번호 (1-based) */
  endLine?: number;
}

/** Pass 1에서 수집된 컬럼 정보 */
interface RawColumn {
  /** 컬럼 논리명 */
  logicalName: string;
  /** FK 참조: 부모 테이블 논리명 */
  fkTable?: string;
  /** FK 참조: 부모 컬럼 논리명 */
  fkColumn?: string;
  /** 도메인 명시 지정 논리명 */
  domainName?: string;
  /** 물리 타입 직접 지정 */
  explicitType?: string;
  /** 옵션 문자열 배열 (PK, AI, NN) */
  options: string[];
  /** 행 번호 (1-based) */
  line: number;
  /** 컬럼 논리명 시작 열 (1-based) */
  nameStartCol: number;
  /** 컬럼 논리명 끝 열 (1-based, exclusive) */
  nameEndCol: number;
  /** 도메인명 시작 열 (1-based) — 도메인 명시 지정일 때만 */
  domainStartCol?: number;
  /** 도메인명 끝 열 (1-based, exclusive) */
  domainEndCol?: number;
  /** 물리 타입 시작 열 (1-based) */
  typeStartCol?: number;
  /** 물리 타입 끝 열 (1-based, exclusive) */
  typeEndCol?: number;
  /** FK 참조 테이블명 시작 열 */
  fkTableStartCol?: number;
  /** FK 참조 테이블명 끝 열 */
  fkTableEndCol?: number;
  /** FK 참조 컬럼명 시작 열 */
  fkColumnStartCol?: number;
  /** FK 참조 컬럼명 끝 열 */
  fkColumnEndCol?: number;
}

/** Pass 1 결과 */
interface Pass1Result {
  /** 수집된 RawTable 목록 */
  rawTables: RawTable[];
  /** 구문 오류 진단 목록 */
  diagnostics: DslError[];
  /** 구문 오류 메시지 목록 */
  errors: string[];
}

/** Pass 2 결과 */
interface Pass2Result {
  /** 파싱된 테이블 목록 */
  tables: ParsedTable[];
  /** 파싱된 FK 관계 목록 */
  relations: ParsedRelation[];
  /** 테이블 범위 정보 (코드 에디터 락 용) */
  tableRanges: ParsedTableRange[];
  /** 물리명 표시 힌트 */
  physicalNameHints: DslPhysicalNameHint[];
  /** 사전 해석/FK 진단 목록 */
  diagnostics: DslError[];
  /** 에러 메시지 목록 */
  errors: string[];
}

/** 파서 상태 머신 */
type ParserState = 'IDLE' | 'EXPECT_TABLE_BLOCK' | 'IN_TABLE';

/** Table 선언 감지 정규식 (공백 포함 논리명 허용) */
const TABLE_DECL_REGEX = new RegExp(`^(\\s*)${DSL_TABLE_KEYWORD}\\s+(.+?)\\s*\\{?\\s*$`);

/** Table 키워드 + 공백 접두사 길이 (위치 계산용) */
const TABLE_PREFIX_LENGTH = `${DSL_TABLE_KEYWORD} `.length;

/** 옵션 키워드 해체 */
const [OPT_PK, OPT_AI, OPT_NN] = DSL_COLUMN_OPTIONS;
/** `::TYPE` 형식의 허용 패턴 */
const EXPLICIT_TYPE_PATTERN =
  /^[A-Za-z][A-Za-z0-9_]*(?:\s+[A-Za-z][A-Za-z0-9_]*)*(?:\s*\([^)]+\))?$/;
interface ResolvedDslTerm {
  physicalName: string;
  termId?: number;
  domainId?: number;
  physicalType?: string;
  matched: boolean;
  wordCompleteMatch: boolean;
}

/**
 * 물리명 힌트 메타데이터를 수집할지 판정한다.
 *
 * @param logicalName 논리명
 * @param physicalName 물리명
 * @returns 메타데이터 수집 여부
 */
function shouldCollectPhysicalNameHint(logicalName: string, physicalName: string): boolean {
  return logicalName.trim().length > 0 && physicalName.trim().length > 0;
}

/**
 * 물리명 view hint 메타데이터를 누적 배열에 추가한다.
 *
 * @param physicalNameHints 누적 배열
 * @param kind 힌트 종류
 * @param tableLogicalName 소속 테이블 논리명
 * @param line 1-based 행 번호
 * @param column 1-based 표시 열
 * @param logicalName 논리명
 * @param physicalName 물리명
 * @returns 없음
 */
function pushPhysicalNameHint(
  physicalNameHints: DslPhysicalNameHint[],
  kind: DslPhysicalNameHint['kind'],
  tableLogicalName: string | undefined,
  line: number,
  column: number,
  logicalName: string,
  physicalName: string,
): void {
  if (!shouldCollectPhysicalNameHint(logicalName, physicalName)) {
    return;
  }

  physicalNameHints.push({
    kind,
    tableLogicalName,
    line,
    column,
    logicalName,
    physicalName,
  });
}

// ─── 유틸 함수 ────────────────────────────────────────────────────

/**
 * 행 전체를 강조하기 위한 1-based 컬럼 범위를 계산한다.
 *
 * @param line 원본 행 텍스트
 * @returns 시작/끝 컬럼 (end exclusive)
 */
function getLineColumns(line: string): { startColumn: number; endColumn: number } {
  const endColumn = Math.max(2, line.replace(/\r$/, '').length + 1);
  return { startColumn: 1, endColumn };
}

/**
 * 식별자 양끝의 동일한 따옴표를 제거한다.
 *
 * DSL에서 `'논리명'`, `"논리명"` 형태를 허용하기 위한 정규화 유틸.
 *
 * @param value 원본 식별자 문자열
 * @returns 따옴표 제거 후 문자열
 */
function unwrapQuotedIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }
  const first = trimmed.charAt(0);
  const last = trimmed.charAt(trimmed.length - 1);
  if ((first === "'" || first === '"') && first === last) {
    const inner = trimmed.substring(1, trimmed.length - 1).trim();
    if (first === "'") {
      return inner.replace(/''/g, "'");
    }
    return inner.replace(/""/g, '"');
  }
  return trimmed;
}

/**
 * 논리명을 사전 용어로 해석한다.
 *
 * 단어사전 완전 조합으로 물리명을 산출하고,
 * 전체 용어가 등록돼 있을 때만 term/domain/type을 연결한다.
 *
 * @param logicalName 논리명
 * @param dictionary DSL 사전
 * @returns 해석 결과
 */
function resolveDslTerm(logicalName: string, dictionary: DslDictionary): ResolvedDslTerm {
  const resolution = resolveLogicalNameFromDictionary(logicalName, {
    termByName: dictionary.termByName,
    domainById: dictionary.domainById,
    wordMatchIndex: dictionary.wordMatchIndex,
  });

  return {
    physicalName: resolution.isWordCompleteMatch ? resolution.physicalName : logicalName,
    termId: resolution.isRegisteredTerm ? resolution.termId : undefined,
    domainId: resolution.isRegisteredTerm ? (resolution.domainId ?? undefined) : undefined,
    physicalType: resolution.isRegisteredTerm ? resolution.physicalType : undefined,
    matched: resolution.isRegisteredTerm,
    wordCompleteMatch: resolution.isWordCompleteMatch,
  };
}

// ─── FK 참조 위치 계산 헬퍼 ───────────────────────────────────────

/**
 * FK 참조 (`> 부모테이블.부모컬럼`)의 위치를 계산하여 RawColumn에 설정한다.
 *
 * @param result    대상 RawColumn (위치 필드가 설정됨)
 * @param effective 주석 제거 후 원본 행 텍스트
 */
function computeFkPositions(result: RawColumn, effective: string): void {
  const fkIdx = effective.indexOf('>');
  if (fkIdx < 0) {
    return;
  }

  const afterArrowRaw = effective.substring(fkIdx + 1);
  const fkRefMatch = afterArrowRaw.match(/^\s*(.+?)\s*\.\s*(.+?)(?=\s*(?::(?!:)|::|\[|$))/);
  if (!fkRefMatch) {
    return;
  }

  const fkTableRaw = fkRefMatch[1] ?? '';
  const fkColumnRaw = fkRefMatch[2] ?? '';
  const tableOffset = afterArrowRaw.indexOf(fkTableRaw);
  if (tableOffset >= 0) {
    const tableStart = fkIdx + 1 + tableOffset;
    result.fkTableStartCol = tableStart + 1;
    result.fkTableEndCol = result.fkTableStartCol + fkTableRaw.length;
  }

  const dotOffset = afterArrowRaw.indexOf('.', Math.max(0, tableOffset + fkTableRaw.length));
  const colOffset =
    dotOffset >= 0
      ? afterArrowRaw.indexOf(fkColumnRaw, dotOffset + 1)
      : afterArrowRaw.indexOf(fkColumnRaw);
  if (colOffset >= 0) {
    const colStart = fkIdx + 1 + colOffset;
    result.fkColumnStartCol = colStart + 1;
    result.fkColumnEndCol = result.fkColumnStartCol + fkColumnRaw.length;
  }
}

/**
 * 도메인/타입 명시 지정의 위치를 계산하여 RawColumn에 설정한다.
 *
 * @param result          대상 RawColumn
 * @param effective       주석 제거 후 원본 행 텍스트
 * @param rawDomainName   정규식 매칭된 원본 도메인명 (따옴표 포함)
 * @param domainName      따옴표 해제된 도메인명
 * @param rawExplicitType 정규식 매칭된 원본 타입 문자열
 * @param explicitType    트림된 타입 문자열
 */
function computeDomainTypePositions(
  result: RawColumn,
  effective: string,
  rawDomainName: string | undefined,
  domainName: string | undefined,
  rawExplicitType: string | undefined,
  explicitType: string | undefined,
): void {
  if (domainName) {
    result.domainName = domainName;
    const rawDomainToken = rawDomainName?.trim() ?? domainName;
    const domainStart = effective.lastIndexOf(rawDomainToken);
    if (domainStart >= 0) {
      result.domainStartCol = domainStart + 1;
      result.domainEndCol = domainStart + rawDomainToken.length + 1;
    }
  }

  if (explicitType) {
    result.explicitType = explicitType;
    const explicitTypeToken = rawExplicitType?.trim() ?? explicitType;
    const typeStart = effective.lastIndexOf(explicitTypeToken);
    if (typeStart >= 0) {
      result.typeStartCol = typeStart + 1;
      result.typeEndCol = typeStart + explicitTypeToken.length + 1;
    }
  }
}

// ─── parseColumnLine ─────────────────────────────────────────────

/**
 * 단일 컬럼 행을 파싱한다.
 *
 * 형식: `논리명  > 부모테이블.부모컬럼  :도메인명  ::타입  [PK, AI, NN]`
 * 공백이 포함된 논리명/도메인명/FK 참조명도 허용한다.
 *
 * @param line    원본 행 텍스트
 * @param lineNum 1-based 행 번호
 * @returns RawColumn 또는 null (빈 행 등)
 */
function parseColumnLine(line: string, lineNum: number): RawColumn | null {
  // 주석 제거
  const commentIdx = line.indexOf('//');
  const effective = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
  const trimmed = effective.trim();

  if (!trimmed || trimmed === '{' || trimmed === '}') {
    return null;
  }

  // 컬럼 행 정규식 (캡처 그룹으로 위치 추적)
  // 형식: 논리명 [> 부모.컬럼] [:도메인] [::타입] [[옵션]]
  const colRegex =
    /^(\s*)(.+?)(?:\s*>\s*(.+?)\s*\.\s*(.+?))?(?:\s*:(?!:)\s*(.+?))?(?:\s*::\s*(.+?))?(?:\s*\[([^\]]*)\])?\s*$/;
  const match = effective.match(colRegex);
  if (!match) {
    return null;
  }

  const indent = match[1].length;
  const logicalName = unwrapQuotedIdentifier(match[2] ?? '');
  const fkTable = match[3] ? unwrapQuotedIdentifier(match[3]) : undefined;
  const fkColumn = match[4] ? unwrapQuotedIdentifier(match[4]) : undefined;
  const rawDomainName = match[5];
  const domainName = rawDomainName ? unwrapQuotedIdentifier(rawDomainName) : undefined;
  const rawExplicitType = match[6];
  const explicitType = rawExplicitType?.trim();
  const optionStr = match[7];
  if (!logicalName) {
    return null;
  }

  const nameStartCol = indent + 1;
  const nameEndCol = indent + (match[2]?.length ?? logicalName.length) + 1;

  const options: string[] = optionStr
    ? optionStr
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  const result: RawColumn = {
    logicalName,
    options,
    line: lineNum,
    nameStartCol,
    nameEndCol,
  };

  if (fkTable && fkColumn) {
    result.fkTable = fkTable;
    result.fkColumn = fkColumn;
    computeFkPositions(result, effective);
  }

  computeDomainTypePositions(
    result,
    effective,
    rawDomainName,
    domainName,
    rawExplicitType,
    explicitType,
  );

  return result;
}

// ─── Pass 1: 구조 파싱 ──────────────────────────────────────────

/**
 * DSL 텍스트를 구조적으로 파싱하여 RawTable 목록을 수집한다 (Pass 1).
 *
 * 상태 머신(IDLE → EXPECT_TABLE_BLOCK → IN_TABLE)으로 테이블 블록과
 * 컬럼 행을 인식한다. 사전 해석은 수행하지 않는다.
 *
 * @param lines DSL 텍스트를 줄 단위로 분할한 배열
 * @returns Pass1Result (rawTables, 구문 오류 diagnostics, errors)
 */
function parsePass1(lines: string[]): Pass1Result {
  const diagnostics: DslError[] = [];
  const rawTables: RawTable[] = [];
  const errors: string[] = [];

  /**
   * 문법 오류를 diagnostics/errors에 동기 반영한다.
   *
   * @param line        행 번호 (1-based)
   * @param sourceLine  오류 대상 원본 행
   */
  const pushSyntaxError = (line: number, sourceLine: string) => {
    const { startColumn, endColumn } = getLineColumns(sourceLine);
    diagnostics.push({
      messageKey: 'erd.dsl.error.syntaxError',
      line,
      startColumn,
      endColumn,
      severity: 'error',
    });
    errors.push(`Syntax error: line ${line}`);
  };

  let state: ParserState = 'IDLE';
  let currentTable: RawTable | null = null;
  let pendingTable: RawTable | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // 주석 제거
    const commentIdx = line.indexOf('//');
    const effective = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
    const trimmed = effective.trim();

    if (!trimmed) {
      continue;
    }

    if (state === 'EXPECT_TABLE_BLOCK') {
      if (trimmed === '{' && pendingTable) {
        currentTable = pendingTable;
        rawTables.push(currentTable);
        pendingTable = null;
        state = 'IN_TABLE';
        continue;
      }

      if (pendingTable) {
        const pendingLineRaw = lines[pendingTable.line - 1] ?? '';
        pushSyntaxError(pendingTable.line, pendingLineRaw);
      }
      pendingTable = null;
      state = 'IDLE';

      // 현재 라인을 IDLE 상태에서 다시 파싱하여 유효한 다음 선언을 놓치지 않는다.
      i -= 1;
      continue;
    }

    if (state === 'IDLE') {
      // Table 선언 감지
      const tableMatch = effective.match(TABLE_DECL_REGEX);
      if (tableMatch) {
        const prefix = tableMatch[1].length;
        const nameStart = prefix + TABLE_PREFIX_LENGTH;
        const rawLogicalName = tableMatch[2] ?? '';
        const logicalName = unwrapQuotedIdentifier(rawLogicalName);
        if (!logicalName) {
          pushSyntaxError(lineNum, effective);
          continue;
        }
        const nextTable: RawTable = {
          logicalName,
          line: lineNum,
          nameStartCol: nameStart + 1,
          nameEndCol: nameStart + rawLogicalName.length + 1,
          columns: [],
        };

        // { 가 같은 행에 있으면 즉시 테이블 블록 시작
        if (trimmed.endsWith('{')) {
          currentTable = nextTable;
          rawTables.push(currentTable);
          state = 'IN_TABLE';
        } else {
          // 엄격 문법: 다음 유효 라인에서 반드시 { 가 와야 한다.
          pendingTable = nextTable;
          state = 'EXPECT_TABLE_BLOCK';
        }
        continue;
      }

      // 단독 { 는 직전 Table 선언이 없는 경우 문법 오류
      if (trimmed === '{') {
        pushSyntaxError(lineNum, effective);
        continue;
      }

      pushSyntaxError(lineNum, effective);
      continue;
    }

    if (state === 'IN_TABLE') {
      // 테이블 블록 종료
      if (trimmed === '}') {
        if (currentTable) {
          currentTable.endLine = lineNum;
        }
        state = 'IDLE';
        currentTable = null;
        continue;
      }

      // 컬럼 파싱
      if (currentTable) {
        const col = parseColumnLine(effective, lineNum);
        if (col) {
          currentTable.columns.push(col);
        } else {
          pushSyntaxError(lineNum, effective);
        }
      }
    }
  }

  if (state === 'EXPECT_TABLE_BLOCK' && pendingTable) {
    const pendingLineRaw = lines[pendingTable.line - 1] ?? '';
    pushSyntaxError(pendingTable.line, pendingLineRaw);
  }

  if (state === 'IN_TABLE' && currentTable) {
    currentTable.endLine = lines.length;
    const tableLineRaw = lines[currentTable.line - 1] ?? '';
    pushSyntaxError(currentTable.line, tableLineRaw);
  }

  return { rawTables, diagnostics, errors };
}

// ─── Pass 2: 사전 해석 + FK 참조 ────────────────────────────────

/**
 * Pass 1에서 수집된 RawTable 목록을 사전으로 해석하고 FK 관계를 연결한다 (Pass 2).
 *
 * 각 테이블/컬럼의 논리명을 사전(Term/Domain)에서 물리명으로 변환하고,
 * FK 참조를 물리명 기반으로 해석한다. 미등록 용어, 중복 컬럼, 도메인 충돌 등의
 * 진단을 생성한다.
 *
 * @param rawTables  Pass 1에서 수집된 RawTable 배열
 * @param dictionary 사전 데이터 (Term/Domain 매핑)
 * @returns Pass2Result (tables, relations, tableRanges, diagnostics, errors)
 */
function parsePass2(rawTables: RawTable[], dictionary: DslDictionary): Pass2Result {
  const diagnostics: DslError[] = [];
  const errors: string[] = [];
  const tables: ParsedTable[] = [];
  const relations: ParsedRelation[] = [];
  const tableRanges: ParsedTableRange[] = [];
  const physicalNameHints: DslPhysicalNameHint[] = [];

  // 논리명 → 물리 테이블명 매핑 (FK 참조 해석용)
  const tablePhysicalMap = new Map<string, string>();
  // 논리명 → 컬럼 물리명 Set (FK 참조 해석용)
  const tableColumnsPhysical = new Map<string, Map<string, string>>();

  for (const rawTable of rawTables) {
    // 테이블명 사전 해석
    const tableTerm = resolveDslTerm(rawTable.logicalName, dictionary);
    const physicalTableName = tableTerm.physicalName;
    const tableTermId = tableTerm.termId;

    pushPhysicalNameHint(
      physicalNameHints,
      'table',
      rawTable.logicalName,
      rawTable.line,
      rawTable.nameEndCol,
      rawTable.logicalName,
      physicalTableName,
    );

    if (!tableTerm.matched) {
      diagnostics.push({
        messageKey: 'erd.dsl.error.unknownTerm',
        messageArgs: { name: rawTable.logicalName },
        line: rawTable.line,
        startColumn: rawTable.nameStartCol,
        endColumn: rawTable.nameEndCol,
        severity: 'error',
      });
      errors.push(`Unknown term: ${rawTable.logicalName} (line ${rawTable.line})`);
    }

    const parsedColumns: ParsedColumn[] = [];
    const colPhysicalMap = new Map<string, string>();
    const seenLogicalColumns = new Map<string, RawColumn>();
    const seenPhysicalColumns = new Map<string, RawColumn>();

    for (const rawCol of rawTable.columns) {
      resolveColumn(
        rawCol,
        rawTable,
        physicalTableName,
        dictionary,
        diagnostics,
        errors,
        parsedColumns,
        colPhysicalMap,
        seenLogicalColumns,
        seenPhysicalColumns,
        physicalNameHints,
      );
    }

    tables.push({
      name: physicalTableName,
      logicalTableName: rawTable.logicalName,
      tableTermId,
      columns: parsedColumns,
    });

    tableRanges.push({
      tableKey: buildTableLockKey({
        logicalName: rawTable.logicalName,
        physicalName: physicalTableName,
        columns: parsedColumns.map((column) => ({
          name: column.name,
          type: column.type,
          pk: column.pk,
          fk: false,
        })),
      }),
      startLine: rawTable.line,
      endLine: rawTable.endLine ?? rawTable.line,
    });

    tablePhysicalMap.set(rawTable.logicalName, physicalTableName);
    tableColumnsPhysical.set(rawTable.logicalName, colPhysicalMap);
  }

  // FK 관계 해석
  resolveFkRelations(
    rawTables,
    tablePhysicalMap,
    tableColumnsPhysical,
    relations,
    diagnostics,
    errors,
  );

  return { tables, relations, tableRanges, physicalNameHints, diagnostics, errors };
}

/**
 * 단일 RawColumn을 사전 해석하여 ParsedColumn으로 변환한다.
 *
 * 도메인/타입 명시 지정, 중복 검사, 옵션 파싱을 처리한다.
 *
 * @param rawCol              원본 컬럼 데이터
 * @param rawTable            소속 테이블 데이터
 * @param physicalTableName   물리 테이블명 (에러 메시지용)
 * @param dictionary          사전 데이터
 * @param diagnostics         진단 누적 배열
 * @param errors              에러 메시지 누적 배열
 * @param parsedColumns       결과 컬럼 누적 배열
 * @param colPhysicalMap      컬럼 논리명→물리명 매핑
 * @param seenLogicalColumns  이미 등장한 논리 컬럼명 추적
 * @param seenPhysicalColumns 이미 등장한 물리 컬럼명 추적
 * @param physicalNameHints   물리명 힌트 누적 배열
 */
function resolveColumn(
  rawCol: RawColumn,
  rawTable: RawTable,
  physicalTableName: string,
  dictionary: DslDictionary,
  diagnostics: DslError[],
  errors: string[],
  parsedColumns: ParsedColumn[],
  colPhysicalMap: Map<string, string>,
  seenLogicalColumns: Map<string, RawColumn>,
  seenPhysicalColumns: Map<string, RawColumn>,
  physicalNameHints: DslPhysicalNameHint[],
): void {
  const duplicated = seenLogicalColumns.get(rawCol.logicalName);
  if (duplicated) {
    diagnostics.push({
      messageKey: 'erd.dsl.error.duplicateColumnLogicalName',
      messageArgs: {
        name: rawCol.logicalName,
        table: rawTable.logicalName,
        firstLine: String(duplicated.line),
      },
      line: rawCol.line,
      startColumn: rawCol.nameStartCol,
      endColumn: rawCol.nameEndCol,
      severity: 'error',
    });
    errors.push(
      `Duplicate column logical name: ${rawTable.logicalName}.${rawCol.logicalName} (line ${rawCol.line})`,
    );
  } else {
    seenLogicalColumns.set(rawCol.logicalName, rawCol);
  }

  const colTerm = resolveDslTerm(rawCol.logicalName, dictionary);
  const physicalName = colTerm.physicalName;
  const termId = colTerm.termId;
  let domainId = colTerm.domainId;
  let physicalType = 'VARCHAR(255)';

  pushPhysicalNameHint(
    physicalNameHints,
    'column',
    rawTable.logicalName,
    rawCol.line,
    rawCol.nameEndCol,
    rawCol.logicalName,
    physicalName,
  );

  if (colTerm.physicalType) {
    physicalType = colTerm.physicalType;
  }

  if (!colTerm.matched) {
    diagnostics.push({
      messageKey: 'erd.dsl.error.unknownTerm',
      messageArgs: { name: rawCol.logicalName },
      line: rawCol.line,
      startColumn: rawCol.nameStartCol,
      endColumn: rawCol.nameEndCol,
      severity: 'error',
    });
    errors.push(`Unknown term: ${rawCol.logicalName} (line ${rawCol.line})`);
  }

  // 도메인 명시 지정 (`:도메인명`)
  if (rawCol.domainName) {
    const explicitDomain = dictionary.domainByName.get(rawCol.domainName);
    if (explicitDomain) {
      domainId = explicitDomain.id;
      physicalType = explicitDomain.physicalType;
    } else {
      diagnostics.push({
        messageKey: 'erd.dsl.error.unknownDomain',
        messageArgs: { name: rawCol.domainName },
        line: rawCol.line,
        startColumn: rawCol.domainStartCol ?? rawCol.nameStartCol,
        endColumn: rawCol.domainEndCol ?? rawCol.nameEndCol,
        severity: 'error',
      });
      errors.push(`Unknown domain: ${rawCol.domainName} (line ${rawCol.line})`);
    }
  }

  // 타입 직접 지정 (`::VARCHAR(200)`) — 도메인과 동시 지정은 금지
  if (rawCol.explicitType) {
    if (rawCol.domainName) {
      diagnostics.push({
        messageKey: 'erd.dsl.error.domainAndTypeConflict',
        line: rawCol.line,
        startColumn: rawCol.typeStartCol ?? rawCol.nameStartCol,
        endColumn: rawCol.typeEndCol ?? rawCol.nameEndCol,
        severity: 'error',
      });
      errors.push(`Domain and type conflict: line ${rawCol.line}`);
    } else {
      const normalizedType = rawCol.explicitType.trim();
      const typeLooksValid = EXPLICIT_TYPE_PATTERN.test(normalizedType);
      if (!typeLooksValid) {
        diagnostics.push({
          messageKey: 'erd.dsl.error.invalidTypeFormat',
          messageArgs: { type: normalizedType },
          line: rawCol.line,
          startColumn: rawCol.typeStartCol ?? rawCol.nameStartCol,
          endColumn: rawCol.typeEndCol ?? rawCol.nameEndCol,
          severity: 'error',
        });
        errors.push(`Invalid type format: ${normalizedType} (line ${rawCol.line})`);
      } else {
        domainId = undefined;
        physicalType = normalizedType;
      }
    }
  }

  const physicalKey = physicalName.toLowerCase();
  const duplicatedPhysical = seenPhysicalColumns.get(physicalKey);
  if (duplicatedPhysical) {
    diagnostics.push({
      messageKey: 'erd.dsl.error.duplicateColumnPhysicalName',
      messageArgs: {
        name: physicalName,
        table: rawTable.logicalName,
        firstLine: String(duplicatedPhysical.line),
      },
      line: rawCol.line,
      startColumn: rawCol.nameStartCol,
      endColumn: rawCol.nameEndCol,
      severity: 'error',
    });
    errors.push(
      `Duplicate column physical name: ${physicalTableName}.${physicalName} (line ${rawCol.line})`,
    );
  } else {
    seenPhysicalColumns.set(physicalKey, rawCol);
  }

  // Domain 미연결 경고
  if (colTerm.matched && !domainId && !rawCol.domainName && !rawCol.explicitType) {
    diagnostics.push({
      messageKey: 'erd.dsl.warning.noDomain',
      messageArgs: { name: rawCol.logicalName },
      line: rawCol.line,
      startColumn: rawCol.nameStartCol,
      endColumn: rawCol.nameEndCol,
      severity: 'warning',
    });
  }

  // 옵션 파싱
  const options = new Set(rawCol.options.map((o) => o.toUpperCase().trim()));
  const isPk = options.has(OPT_PK);
  const isAI = options.has(OPT_AI);
  const isNN = options.has(OPT_NN);

  parsedColumns.push({
    name: physicalName,
    type: physicalType,
    pk: isPk,
    nullable: isPk ? false : !isNN,
    autoIncrement: isAI,
    logicalName: rawCol.logicalName,
    termId,
    domainId,
  });

  colPhysicalMap.set(rawCol.logicalName, physicalName);
}

/**
 * FK 관계를 해석하여 ParsedRelation 배열에 추가한다.
 *
 * @param rawTables             원본 테이블 목록
 * @param tablePhysicalMap      논리명→물리 테이블명 매핑
 * @param tableColumnsPhysical  논리명→컬럼 물리명 매핑
 * @param relations             결과 관계 누적 배열
 * @param diagnostics           진단 누적 배열
 * @param errors                에러 메시지 누적 배열
 */
function resolveFkRelations(
  rawTables: RawTable[],
  tablePhysicalMap: Map<string, string>,
  tableColumnsPhysical: Map<string, Map<string, string>>,
  relations: ParsedRelation[],
  diagnostics: DslError[],
  errors: string[],
): void {
  for (const rawTable of rawTables) {
    const childTablePhysical = tablePhysicalMap.get(rawTable.logicalName);
    if (!childTablePhysical) {
      continue;
    }

    for (const rawCol of rawTable.columns) {
      if (!rawCol.fkTable || !rawCol.fkColumn) {
        continue;
      }

      const parentTablePhysical = tablePhysicalMap.get(rawCol.fkTable);
      const parentColMap = tableColumnsPhysical.get(rawCol.fkTable);

      if (!parentTablePhysical) {
        diagnostics.push({
          messageKey: 'erd.dsl.error.unknownFkTable',
          messageArgs: { name: rawCol.fkTable },
          line: rawCol.line,
          startColumn: rawCol.fkTableStartCol ?? rawCol.nameStartCol,
          endColumn: rawCol.fkTableEndCol ?? rawCol.nameEndCol,
          severity: 'error',
        });
        errors.push(`Unknown FK table: ${rawCol.fkTable} (line ${rawCol.line})`);
        continue;
      }

      const parentColPhysical = parentColMap?.get(rawCol.fkColumn);
      if (!parentColPhysical) {
        diagnostics.push({
          messageKey: 'erd.dsl.error.unknownFkColumn',
          messageArgs: { table: rawCol.fkTable, column: rawCol.fkColumn },
          line: rawCol.line,
          startColumn: rawCol.fkColumnStartCol ?? rawCol.nameStartCol,
          endColumn: rawCol.fkColumnEndCol ?? rawCol.nameEndCol,
          severity: 'error',
        });
        errors.push(
          `Unknown FK column: ${rawCol.fkTable}.${rawCol.fkColumn} (line ${rawCol.line})`,
        );
        continue;
      }

      // 자식 컬럼의 물리명
      const childColMap = tableColumnsPhysical.get(rawTable.logicalName);
      const childColPhysical = childColMap?.get(rawCol.logicalName);
      if (!childColPhysical) {
        continue;
      }

      relations.push({
        childTable: childTablePhysical,
        childColumn: childColPhysical,
        parentTable: parentTablePhysical,
        parentColumn: parentColPhysical,
      });
    }
  }
}

// ─── parseDsl (공개 API) ─────────────────────────────────────────

/**
 * 논리명 DSL을 파싱하여 ERD 생성용 데이터를 반환한다.
 *
 * 2-pass 라인 스캐너:
 * - Pass 1: 구조 파싱 (테이블/컬럼 수집)
 * - Pass 2: 사전 해석 + FK 참조 해석
 *
 * @param dsl        DSL 텍스트
 * @param dictionary 사전 데이터 (Term/Domain 매핑)
 * @returns DslParseResult
 */
export function parseDsl(dsl: string, dictionary: DslDictionary): DslParseResult {
  const lines = dsl.split('\n');

  // Pass 1: 구조 파싱
  const pass1 = parsePass1(lines);

  // Pass 2: 사전 해석 + FK 참조
  const pass2 = parsePass2(pass1.rawTables, dictionary);

  // 진단 합산
  const diagnostics = [...pass1.diagnostics, ...pass2.diagnostics];
  const errors = [...pass1.errors, ...pass2.errors];

  return {
    result: {
      diagnostics: [],
      tables: pass2.tables,
      relations: pass2.relations,
      errors,
      tableRanges: pass2.tableRanges,
    },
    diagnostics,
    physicalNameHints: pass2.physicalNameHints,
  };
}
