import type { DdlParseResult, ParsedColumn, ParsedRelation, ParsedTable } from '@/lib/ddl-parser';
import type { Term, Domain } from '@/types/dictionary';
import { DSL_TABLE_KEYWORD, DSL_COLUMN_OPTIONS } from '@/lib/dsl-keywords';

/** DSL 파싱에 필요한 사전 데이터 */
export interface DslDictionary {
  /** 논리명 → Term 매핑 */
  termByName: Map<string, Term>;
  /** 논리명 → Domain 매핑 */
  domainByName: Map<string, Domain>;
  /** ID → Domain 매핑 */
  domainById: Map<number, Domain>;
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
  /** FK 참조 테이블명 시작 열 */
  fkTableStartCol?: number;
  /** FK 참조 테이블명 끝 열 */
  fkTableEndCol?: number;
  /** FK 참조 컬럼명 시작 열 */
  fkColumnStartCol?: number;
  /** FK 참조 컬럼명 끝 열 */
  fkColumnEndCol?: number;
}

/** 파서 상태 머신 */
type ParserState = 'IDLE' | 'EXPECT_TABLE_BLOCK' | 'IN_TABLE';

/** Table 선언 감지 정규식 */
const TABLE_DECL_REGEX = new RegExp(`^(\\s*)${DSL_TABLE_KEYWORD}\\s+(\\S+)\\s*\\{?\\s*$`);

/** Table 키워드 + 공백 접두사 길이 (위치 계산용) */
const TABLE_PREFIX_LENGTH = `${DSL_TABLE_KEYWORD} `.length;

/** 옵션 키워드 해체 */
const [OPT_PK, OPT_AI, OPT_NN] = DSL_COLUMN_OPTIONS;

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

  // === Pass 1: 구조 파싱 ===
  const lines = dsl.split('\n');
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
        const logicalName = tableMatch[2];
        const nextTable: RawTable = {
          logicalName,
          line: lineNum,
          nameStartCol: nameStart + 1,
          nameEndCol: nameStart + logicalName.length + 1,
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
    const tableLineRaw = lines[currentTable.line - 1] ?? '';
    pushSyntaxError(currentTable.line, tableLineRaw);
  }

  // === Pass 2: 사전 해석 + FK 참조 ===
  const tables: ParsedTable[] = [];
  const relations: ParsedRelation[] = [];

  // 논리명 → 물리 테이블명 매핑 (FK 참조 해석용)
  const tablePhysicalMap = new Map<string, string>();
  // 논리명 → 컬럼 물리명 Set (FK 참조 해석용)
  const tableColumnsPhysical = new Map<string, Map<string, string>>();

  for (const rawTable of rawTables) {
    // 테이블명 사전 해석
    const tableTerm = dictionary.termByName.get(rawTable.logicalName);
    let physicalTableName: string;
    let tableTermId: number | undefined;

    if (tableTerm) {
      physicalTableName = tableTerm.physicalName;
      tableTermId = tableTerm.id;
    } else {
      physicalTableName = rawTable.logicalName;
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

    for (const rawCol of rawTable.columns) {
      const colTerm = dictionary.termByName.get(rawCol.logicalName);
      let physicalName: string;
      let termId: number | undefined;
      let domainId: number | undefined;
      let physicalType = 'VARCHAR(255)';

      if (colTerm) {
        physicalName = colTerm.physicalName;
        termId = colTerm.id;

        // 기본 도메인 (Term에 연결된 도메인)
        if (colTerm.domainId) {
          domainId = colTerm.domainId;
          const domain = dictionary.domainById.get(colTerm.domainId);
          if (domain) {
            physicalType = domain.physicalType;
          }
        }
      } else {
        physicalName = rawCol.logicalName;
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

      // Domain 미연결 경고
      if (colTerm && !domainId && !rawCol.domainName) {
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

    tables.push({
      name: physicalTableName,
      logicalTableName: rawTable.logicalName,
      tableTermId,
      columns: parsedColumns,
    });

    tablePhysicalMap.set(rawTable.logicalName, physicalTableName);
    tableColumnsPhysical.set(rawTable.logicalName, colPhysicalMap);
  }

  // FK 관계 해석
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

  return {
    result: { diagnostics: [], tables, relations, errors },
    diagnostics,
  };
}

/**
 * 단일 컬럼 행을 파싱한다.
 *
 * 형식: `논리명  > 부모테이블.부모컬럼  :도메인명  [PK, AI, NN]`
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
  const colRegex = /^(\s*)(\S+)(?:\s+>\s*(\S+)\.(\S+))?(?:\s+:(\S+))?(?:\s+\[([^\]]*)\])?\s*$/;
  const match = effective.match(colRegex);
  if (!match) return null;

  const indent = match[1].length;
  const logicalName = match[2];
  const fkTable = match[3];
  const fkColumn = match[4];
  const domainName = match[5];
  const optionStr = match[6];

  const nameStartCol = indent + 1;
  const nameEndCol = indent + logicalName.length + 1;

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

    // FK 참조 위치 계산
    const fkIdx = effective.indexOf('>');
    if (fkIdx >= 0) {
      const afterArrow = effective.substring(fkIdx + 1).trimStart();
      const fkStart = effective.indexOf(afterArrow, fkIdx + 1);
      const dotIdx = afterArrow.indexOf('.');
      if (dotIdx >= 0) {
        result.fkTableStartCol = fkStart + 1;
        result.fkTableEndCol = fkStart + dotIdx + 1;
        result.fkColumnStartCol = fkStart + dotIdx + 2;
        result.fkColumnEndCol = fkStart + afterArrow.trimEnd().length + 1;
      }
    }
  }

  if (domainName) {
    result.domainName = domainName;
    const colonIdx = effective.indexOf(':');
    if (colonIdx >= 0) {
      // : 다음 공백 제거 후 도메인명 시작 위치
      const afterColon = effective.substring(colonIdx + 1);
      const domainStart = colonIdx + 1 + (afterColon.length - afterColon.trimStart().length);
      result.domainStartCol = domainStart + 1;
      result.domainEndCol = domainStart + domainName.length + 1;
    }
  }

  return result;
}
