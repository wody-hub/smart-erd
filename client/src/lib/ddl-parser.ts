import type { DbmsType } from '../types/erd.js';
import { buildTableLockKey } from './table-lock-key.js';

/** DDL 파싱된 컬럼 정보 */
export interface ParsedColumn {
  /** 컬럼 물리명 */
  name: string;
  /** 데이터 타입 */
  type: string;
  /** Primary Key 여부 */
  pk: boolean;
  /** NULL 허용 여부 */
  nullable: boolean;
  /** 자동증가 여부 */
  autoIncrement: boolean;
  /** COMMENT → logicalName */
  comment?: string;
  /** 논리명 (DSL: 입력 논리명, SQL DDL: COMMENT와 동일) */
  logicalName?: string;
  /** DSL 파서에서 해석된 Term ID */
  termId?: number;
  /** DSL 파서에서 해석된 Domain ID */
  domainId?: number;
}

/** DDL 파싱된 테이블 정보 */
export interface ParsedTable {
  /** 테이블 물리명 */
  name: string;
  /** 테이블 COMMENT → logicalTableName */
  comment?: string;
  /** 테이블 논리명 (DSL: 입력 논리명) */
  logicalTableName?: string;
  /** DSL 파서에서 해석된 테이블 Term ID */
  tableTermId?: number;
  /** 컬럼 목록 */
  columns: ParsedColumn[];
}

/** DDL 파싱된 FK 관계 정보 */
export interface ParsedRelation {
  /** 자식 테이블명 */
  childTable: string;
  /** 자식 컬럼명 */
  childColumn: string;
  /** 부모 테이블명 */
  parentTable: string;
  /** 부모 컬럼명 */
  parentColumn: string;
}

/** DDL 파싱 결과 */
export interface DdlParseResult {
  /** 위치/심각도 포함 진단 목록 (UI 어댑터에서 Monaco 마커로 변환) */
  diagnostics: DdlDiagnostic[];
  /** 파싱된 테이블 목록 */
  tables: ParsedTable[];
  /** 파싱된 FK 관계 목록 */
  relations: ParsedRelation[];
  /** 파싱 중 발생한 에러 메시지 목록 */
  errors: string[];
  /** 파싱된 테이블 라인 범위 목록 (코드 편집 락 연동용) */
  tableRanges: ParsedTableRange[];
}

/** 파싱된 테이블 라인 범위 정보 */
export interface ParsedTableRange {
  /** 소프트 락 식별용 테이블 키 */
  tableKey: string;
  /** 테이블 시작 라인 (1-based) */
  startLine: number;
  /** 테이블 종료 라인 (1-based) */
  endLine: number;
}

/** DDL 진단 정보 (i18n 키 + 선택적 위치 정보) */
export interface DdlDiagnostic {
  /** i18n 키 */
  messageKey: string;
  /** i18n 보간 인자 */
  messageArgs?: Record<string, string>;
  /** 심각도 */
  severity: 'error' | 'warning';
  /** 선택적 위치 정보 (1-based, endColumn exclusive) */
  location?: {
    line: number;
    startColumn: number;
    endColumn: number;
  };
}

/**
 * node-sql-parser 모듈을 동적으로 로드한다 (최초 1회만).
 * 번들 사이즈 최적화를 위해 dynamic import를 사용한다.
 *
 * @param dbms 대상 DBMS 타입
 * @returns node-sql-parser 모듈
 */
async function getParser(dbms: DbmsType): Promise<{ Parser: new () => ParserInstance }> {
  switch (dbms) {
    case 'postgresql':
      return import('node-sql-parser/build/postgresql');
    case 'sqlserver':
      return import('node-sql-parser/build/transactsql');
    case 'mysql':
    case 'oracle':
    case 'ansi':
    default:
      return import('node-sql-parser/build/mysql');
  }
}

/** node-sql-parser의 Parser 인스턴스 인터페이스 */
interface ParserInstance {
  astify(
    sql: string,
    options?: {
      database?: string;
      parseOptions?: { includeLocations?: boolean };
    },
  ): unknown;
}

/**
 * DBMS 타입을 node-sql-parser의 database 옵션 문자열로 변환한다.
 *
 * @param dbms 대상 DBMS 타입
 * @returns node-sql-parser database 문자열
 */
function mapDbmsToParserDb(dbms: DbmsType): string {
  switch (dbms) {
    case 'mysql':
      return 'MySQL';
    case 'postgresql':
      return 'PostgresQL';
    case 'sqlserver':
      return 'TransactSQL';
    case 'oracle':
    case 'ansi':
    default:
      return 'MySQL';
  }
}

/**
 * 값이 배열인지 보장한다.
 *
 * @param value 단일 값 또는 배열
 * @returns 배열
 */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * node-sql-parser AST 식별자 노드를 문자열 식별자로 정규화한다.
 *
 * @param value AST 식별자 후보 값
 * @param seen  순환 참조 방지용 방문 집합
 * @returns 문자열 식별자 또는 undefined
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractIdentifier(value: any, seen = new Set<unknown>()): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (typeof value.name === 'string') {
    return value.name;
  }
  if (typeof value.column === 'string') {
    return value.column;
  }
  if (typeof value.table === 'string') {
    return value.table;
  }
  if (typeof value.value === 'string') {
    return value.value;
  }

  const nestedCandidates = [value.expr, value.column, value.table, value.value, value.name];
  for (const nested of nestedCandidates) {
    const extracted = extractIdentifier(nested, seen);
    if (extracted) {
      return extracted;
    }
  }

  return undefined;
}

/**
 * AST 테이블 노드에서 테이블명을 추출한다.
 *
 * @param tableNode AST table 노드
 * @returns 테이블명
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTableName(tableNode: any): string {
  for (const candidate of toArray(tableNode)) {
    const name = extractIdentifier(candidate?.table ?? candidate);
    if (name) {
      return name;
    }
  }
  return 'unknown';
}

/**
 * AST 컬럼 목록 노드에서 컬럼명 문자열 배열을 추출한다.
 *
 * @param definition AST definition 노드
 * @returns 컬럼명 배열
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractColumnNames(definition: any): string[] {
  const names: string[] = [];
  for (const item of toArray(definition)) {
    const name = extractIdentifier(item?.column ?? item);
    if (name) names.push(name);
  }
  return names;
}

/**
 * AST 컬럼 정의에서 데이터 타입 문자열을 추출한다.
 *
 * @param definition AST 컬럼 정의 객체
 * @returns 데이터 타입 문자열
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDataType(definition: any): string {
  if (!definition?.dataType) {
    return 'VARCHAR(255)';
  }

  let type = definition.dataType.toUpperCase();

  if (definition.length != null) {
    if (definition.scale != null) {
      type += `(${definition.length},${definition.scale})`;
    } else {
      type += `(${definition.length})`;
    }
  }

  return type;
}

/**
 * AST 컬럼 정의에서 자동증가 여부를 감지한다.
 *
 * @param definition AST 컬럼 정의 객체
 * @param dataType   추출된 데이터 타입 문자열
 * @returns 자동증가 여부
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectAutoIncrement(definition: any, dataType: string): boolean {
  if (definition?.auto_increment) {
    return true;
  }

  const upper = dataType.toUpperCase();
  if (upper === 'SERIAL' || upper === 'BIGSERIAL' || upper === 'SMALLSERIAL') {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (definition?.reference_definition?.definition?.some?.((d: any) => d.type === 'identity')) {
    return true;
  }

  return false;
}

/**
 * AST 컬럼 정의에서 NOT NULL 여부를 감지한다.
 *
 * @param definition AST 컬럼 정의 객체
 * @returns NULL 허용 여부
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectNullable(definition: any): boolean {
  if (!definition?.nullable) {
    return true;
  }
  return definition.nullable.type === 'null';
}

/**
 * AST 컬럼 정의에서 COMMENT 값을 추출한다.
 *
 * @param definition AST 컬럼 정의 객체
 * @returns COMMENT 문자열 또는 undefined
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractColumnComment(definition: any): string | undefined {
  if (definition?.comment?.value?.value) {
    return definition.comment.value.value;
  }
  return undefined;
}

/**
 * 단일 CREATE TABLE AST 문에서 테이블 정보를 추출한다.
 *
 * @param ast CREATE TABLE AST 노드
 * @returns ParsedTable과 인라인 FK 관계 배열
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processCreateTable(ast: any): {
  table: ParsedTable;
  relations: ParsedRelation[];
} {
  const tableName = extractTableName(ast.table);

  const columns: ParsedColumn[] = [];
  const relations: ParsedRelation[] = [];
  const pkColumnNames = new Set<string>();

  const definitions = toArray(ast.create_definitions);

  for (const def of definitions) {
    if (def.resource === 'column') {
      const colName = extractIdentifier(def.column?.column ?? def.column) ?? 'unknown';
      const dataType = extractDataType(def.definition);
      const autoIncrement = detectAutoIncrement(def, dataType);
      const nullable = detectNullable(def);
      const comment = extractColumnComment(def);

      // 인라인 PK 제약조건 감지
      const inlineConstraints = toArray(def.definition?.constraint);
      const isPk =
        Boolean(def.primary_key) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inlineConstraints.some((c: any) => String(c?.type ?? '').toLowerCase() === 'primary key') ||
        String(def.unique_or_primary ?? '').toLowerCase() === 'primary key';

      if (isPk) pkColumnNames.add(colName);

      columns.push({
        name: colName,
        type:
          autoIncrement &&
          (dataType === 'SERIAL' || dataType === 'BIGSERIAL' || dataType === 'SMALLSERIAL')
            ? dataType === 'SMALLSERIAL'
              ? 'SMALLINT'
              : dataType === 'SERIAL'
                ? 'INTEGER'
                : 'BIGINT'
            : dataType,
        pk: isPk,
        nullable: isPk ? false : nullable,
        autoIncrement,
        comment,
      });

      // 컬럼 레벨 REFERENCES 제약조건 (예: parent_id INT REFERENCES parent(id))
      if (def.reference_definition) {
        const refTable = extractTableName(def.reference_definition.table);
        const refCols = extractColumnNames(def.reference_definition.definition);

        for (const refCol of refCols) {
          relations.push({
            childTable: tableName,
            childColumn: colName,
            parentTable: refTable,
            parentColumn: refCol,
          });
        }
      }
    } else if (def.resource === 'constraint') {
      const constraintType = String(def.constraint_type ?? '').toLowerCase();

      if (constraintType === 'primary key') {
        // 테이블 레벨 PK 제약조건
        const pkCols = extractColumnNames(def.definition);
        for (const name of pkCols) {
          pkColumnNames.add(name);
        }
      } else if (constraintType === 'foreign key') {
        // 인라인 FK 제약조건
        const fkCols = extractColumnNames(def.definition);
        const refTable = extractTableName(def.reference_definition?.table);
        const refCols = extractColumnNames(def.reference_definition?.definition);

        for (let i = 0; i < Math.min(fkCols.length, refCols.length); i++) {
          relations.push({
            childTable: tableName,
            childColumn: fkCols[i],
            parentTable: refTable,
            parentColumn: refCols[i],
          });
        }
      }
    }
  }

  // 테이블 레벨 PK를 컬럼에 반영
  for (const col of columns) {
    if (pkColumnNames.has(col.name)) {
      col.pk = true;
      col.nullable = false;
    }
  }

  // 테이블 COMMENT (MySQL CREATE TABLE ... COMMENT='...')
  const tableComment: string | undefined =
    ast.table_options?.find?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opt: any) => opt.keyword === 'comment',
    )?.value ?? undefined;

  return {
    table: { name: tableName, comment: tableComment, columns },
    relations,
  };
}

/**
 * ALTER TABLE ... ADD CONSTRAINT ... FK 문에서 관계를 추출한다.
 *
 * @param ast ALTER TABLE AST 노드
 * @returns FK 관계 배열
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processAlterTable(ast: any): ParsedRelation[] {
  const relations: ParsedRelation[] = [];
  const childTable = extractTableName(ast.table);

  const expressions = toArray(ast.expr);
  for (const expr of expressions) {
    if (expr.action === 'add' && expr.create_definitions) {
      const createDefinitions = toArray(expr.create_definitions);
      for (const def of createDefinitions) {
        if (String(def?.constraint_type ?? '').toLowerCase() !== 'foreign key') continue;

        const fkCols = extractColumnNames(def.definition);
        const refTable = extractTableName(def.reference_definition?.table);
        const refCols = extractColumnNames(def.reference_definition?.definition);

        for (let i = 0; i < Math.min(fkCols.length, refCols.length); i++) {
          relations.push({
            childTable,
            childColumn: fkCols[i],
            parentTable: refTable,
            parentColumn: refCols[i],
          });
        }
      }
    }
  }

  return relations;
}

/**
 * COMMENT ON TABLE/COLUMN 문에서 논리명 매핑을 추출한다.
 * node-sql-parser가 미지원할 수 있으므로 정규식으로 후처리한다.
 *
 * @param ddl 원본 DDL 문자열
 * @returns 테이블 COMMENT 매핑과 컬럼 COMMENT 매핑
 */
function extractCommentStatements(ddl: string): {
  tableComments: Map<string, string>;
  columnComments: Map<string, string>;
} {
  const tableComments = new Map<string, string>();
  const columnComments = new Map<string, string>();

  // COMMENT ON TABLE "schema"."table" IS '...' 또는 COMMENT ON TABLE table IS '...'
  const tableCommentRegex =
    /COMMENT\s+ON\s+TABLE\s+(?:"[^"]*"\s*\.\s*)?["']?(\w+)["']?\s+IS\s+'((?:[^']|'')*)'/gi;
  let match;
  while ((match = tableCommentRegex.exec(ddl)) !== null) {
    tableComments.set(match[1], match[2].replace(/''/g, "'"));
  }

  // COMMENT ON COLUMN "schema"."table"."column" IS '...'
  const colCommentRegex =
    /COMMENT\s+ON\s+COLUMN\s+(?:"[^"]*"\s*\.\s*)?["']?(\w+)["']?\s*\.\s*["']?(\w+)["']?\s+IS\s+'((?:[^']|'')*)'/gi;
  while ((match = colCommentRegex.exec(ddl)) !== null) {
    columnComments.set(`${match[1]}.${match[2]}`, match[3].replace(/''/g, "'"));
  }

  return { tableComments, columnComments };
}

/**
 * node-sql-parser가 처리하지 못하는 PostgreSQL 문법을 파서 호환 형태로 정규화한다.
 *
 * - `GENERATED ALWAYS AS IDENTITY` -> `GENERATED BY DEFAULT AS IDENTITY`
 * - `IDENTITY(...)` 옵션 절 제거
 * - `ALTER TABLE ... ALTER COLUMN ... ADD GENERATED ... AS IDENTITY` 문 제거
 *   (ERD 구조/관계 파싱에는 영향이 없고, parser가 미지원)
 *
 * @param ddl  원본 DDL 문자열
 * @param dbms 대상 DBMS 타입
 * @returns 정규화된 DDL 문자열
 */
function normalizeDdlForParser(ddl: string, dbms: DbmsType): string {
  if (dbms !== 'postgresql') {
    return ddl;
  }

  let normalized = ddl;

  // node-sql-parser(PostgresQL)가 ALWAYS를 처리하지 못해 BY DEFAULT로 다운그레이드
  normalized = normalized.replace(
    /\bGENERATED\s+ALWAYS\s+AS\s+IDENTITY\b/gi,
    'GENERATED BY DEFAULT AS IDENTITY',
  );

  // IDENTITY 시퀀스 옵션 절 제거: IDENTITY(...) -> IDENTITY
  normalized = normalized.replace(
    /\bGENERATED\s+BY\s+DEFAULT\s+AS\s+IDENTITY\s*\([^;]*?\)/gi,
    'GENERATED BY DEFAULT AS IDENTITY',
  );

  // parser 미지원 ALTER IDENTITY ADD 구문 제거
  normalized = normalized.replace(
    /\bALTER\s+TABLE\s+[^;]*?\bALTER\s+COLUMN\b[^;]*?\bADD\s+GENERATED\s+(?:ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY(?:\s*\([^;]*?\))?\s*;/gi,
    (matched) => matched.replace(/[^\n]/g, ' '),
  );

  return normalized;
}

/** 문장 분해 결과 */
interface SqlStatementChunk {
  /** 1-based 문장 인덱스 */
  index: number;
  /** 문장 SQL */
  sql: string;
  /** 원본 SQL 기준 시작 오프셋 (0-based) */
  startOffset: number;
  /** 원본 SQL 기준 시작 라인 (1-based) */
  startLine: number;
  /** 원본 SQL 기준 종료 라인 (1-based) */
  endLine: number;
}

/** SQL 문장에서 추출한 테이블 범위 후보 */
interface CoarseTableRange {
  /** 소문자 테이블명 */
  tableNameLower: string;
  /** 소프트 락 식별용 임시 키 */
  tableKey: string;
  /** 시작 라인 (1-based) */
  startLine: number;
  /** 종료 라인 (1-based) */
  endLine: number;
}

/**
 * 원본 문자열의 각 라인 시작 오프셋을 만든다.
 *
 * @param text 원본 문자열
 * @returns 라인 시작 오프셋 배열 (0-based)
 */
function buildLineStartOffsets(text: string): number[] {
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n' && i + 1 < text.length) {
      lineStarts.push(i + 1);
    }
  }
  return lineStarts;
}

/**
 * 라인 시작 오프셋 배열을 이용해 1-based 라인 번호를 계산한다.
 *
 * @param lineStarts 라인 시작 오프셋 배열
 * @param offset     0-based 오프셋
 * @returns 1-based 라인 번호
 */
function getLineFromLineStarts(lineStarts: number[], offset: number): number {
  const target = Math.max(0, offset);

  let left = 0;
  let right = lineStarts.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (lineStarts[mid] <= target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return Math.max(1, right + 1);
}

/**
 * SQL 스크립트를 세미콜론 기준으로 문장 단위로 분해한다.
 *
 * 문자열/주석 내부의 세미콜론은 분리 기준에서 제외한다.
 *
 * @param ddl SQL 스크립트
 * @returns 분해된 문장 목록
 */
function splitSqlStatements(ddl: string): SqlStatementChunk[] {
  const chunks: SqlStatementChunk[] = [];
  const lineStarts = buildLineStartOffsets(ddl);
  let start = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  const pushChunk = (end: number) => {
    const raw = ddl.slice(start, end);
    const leadingWhitespaceLength = raw.length - raw.trimStart().length;
    const sql = raw.trim();
    if (sql) {
      const startOffset = start + leadingWhitespaceLength;
      chunks.push({
        index: chunks.length + 1,
        sql,
        startOffset,
        startLine: getLineFromLineStarts(lineStarts, startOffset),
        endLine: getLineFromLineStarts(
          lineStarts,
          Math.max(startOffset, startOffset + Math.max(0, sql.length - 1)),
        ),
      });
    }
  };

  for (let i = 0; i < ddl.length; i++) {
    const ch = ddl[i];
    const next = i + 1 < ddl.length ? ddl[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingleQuote) {
      if (ch === "'" && next === "'") {
        i++;
        continue;
      }
      if (ch === "'") inSingleQuote = false;
      continue;
    }

    if (inDoubleQuote) {
      if (ch === '"') inDoubleQuote = false;
      continue;
    }

    if (inBacktick) {
      if (ch === '`') inBacktick = false;
      continue;
    }

    if (ch === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (ch === '`') {
      inBacktick = true;
      continue;
    }

    if (ch === ';') {
      pushChunk(i);
      start = i + 1;
    }
  }

  pushChunk(ddl.length);
  return chunks;
}

/** SQL 식별자 양 끝의 quote/backtick/bracket을 제거한다. */
function stripIdentifierQuotes(identifier: string): string {
  const trimmed = identifier.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * CREATE TABLE 문에서 테이블 물리명을 추출한다.
 *
 * @param sql 단일 SQL 문장
 * @returns 테이블명 또는 null
 */
function extractCreateTableNameFromSql(sql: string): string | null {
  const match = sql.match(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+))?)/i,
  );
  if (!match) {
    return null;
  }

  const rawName = match[1].trim();
  const parts = rawName.split('.').map((part) => stripIdentifierQuotes(part));
  return parts[parts.length - 1] || null;
}

/**
 * ALTER TABLE 문에서 대상 테이블명을 추출한다.
 *
 * @param sql 단일 SQL 문장
 * @returns 테이블명 또는 null
 */
function extractAlterTableNameFromSql(sql: string): string | null {
  const match = sql.match(
    /alter\s+table\s+(?:if\s+exists\s+)?((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+))?)/i,
  );
  if (!match) {
    return null;
  }
  const rawName = match[1].trim();
  const parts = rawName.split('.').map((part) => stripIdentifierQuotes(part));
  return parts[parts.length - 1] || null;
}

/**
 * COMMENT ON TABLE/COLUMN 문에서 대상 테이블명을 추출한다.
 *
 * @param sql 단일 SQL 문장
 * @returns 테이블명 또는 null
 */
function extractCommentTargetTableName(sql: string): string | null {
  const tableMatch = sql.match(
    /comment\s+on\s+table\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+))?)/i,
  );
  if (tableMatch) {
    const parts = tableMatch[1]
      .trim()
      .split('.')
      .map((part) => stripIdentifierQuotes(part));
    return parts[parts.length - 1] || null;
  }

  const columnMatch = sql.match(
    /comment\s+on\s+column\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+)\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z0-9_]+))?)/i,
  );
  if (!columnMatch) {
    return null;
  }
  const parts = columnMatch[1]
    .trim()
    .split('.')
    .map((part) => stripIdentifierQuotes(part));
  if (parts.length < 2) {
    return null;
  }
  return parts.length === 2 ? parts[0] : parts[1];
}

/**
 * SQL 문장 분해 결과에서 테이블 라인 범위를 추출한다.
 *
 * @param chunks SQL 문장 분해 결과
 * @returns 테이블 범위 목록
 */
function buildTableRangesFromChunks(chunks: SqlStatementChunk[]): CoarseTableRange[] {
  const ranges: CoarseTableRange[] = [];

  for (const chunk of chunks) {
    const candidateNames = [
      extractCreateTableNameFromSql(chunk.sql),
      extractAlterTableNameFromSql(chunk.sql),
      extractCommentTargetTableName(chunk.sql),
    ].filter((value): value is string => Boolean(value));

    for (const tableName of candidateNames) {
      const tableNameLower = tableName.toLowerCase();
      ranges.push({
        tableNameLower,
        tableKey: buildTableLockKey({
          physicalName: tableName,
          columns: [],
        }),
        startLine: chunk.startLine,
        endLine: Math.max(chunk.startLine, chunk.endLine),
      });
    }
  }

  return ranges;
}

/**
 * CREATE TABLE 문장 기준 테이블 시작 라인 맵을 만든다.
 *
 * @param chunks SQL 문장 분해 결과
 * @returns 테이블 소문자명 -> 시작 라인(1-based)
 */
function buildCreateTableStartLineMap(chunks: SqlStatementChunk[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const chunk of chunks) {
    const tableName = extractCreateTableNameFromSql(chunk.sql);
    if (!tableName) {
      continue;
    }
    const key = tableName.toLowerCase();
    if (!map.has(key)) {
      map.set(key, chunk.startLine);
    }
  }
  return map;
}

/**
 * node-sql-parser SyntaxError 위치를 DdlDiagnostic 위치 스키마로 변환한다.
 *
 * @param error 파서 오류 객체
 * @returns 위치 정보 또는 undefined
 */
function extractParserErrorLocation(error: unknown): DdlDiagnostic['location'] | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const locationRaw = (error as { location?: unknown }).location;
  if (!locationRaw || typeof locationRaw !== 'object') {
    return undefined;
  }

  const start = (locationRaw as { start?: unknown }).start;
  const end = (locationRaw as { end?: unknown }).end;
  if (!start || typeof start !== 'object') {
    return undefined;
  }

  const lineRaw = (start as { line?: unknown }).line;
  const startColumnRaw = (start as { column?: unknown }).column;
  const endColumnRaw =
    end && typeof end === 'object' ? (end as { column?: unknown }).column : undefined;

  const line = Number(lineRaw);
  const startColumn = Number(startColumnRaw);
  const endColumn = Number(endColumnRaw);

  if (!Number.isFinite(line) || line < 1) {
    return undefined;
  }

  const normalizedStartColumn =
    Number.isFinite(startColumn) && startColumn >= 1 ? Math.floor(startColumn) : 1;
  const normalizedEndColumn =
    Number.isFinite(endColumn) && endColumn > normalizedStartColumn
      ? Math.floor(endColumn)
      : normalizedStartColumn + 1;

  return {
    line: Math.floor(line),
    startColumn: normalizedStartColumn,
    endColumn: normalizedEndColumn,
  };
}

/**
 * 문장 단위(local) 위치를 원본 SQL 기준(global) 위치로 변환한다.
 *
 * @param location  local 위치
 * @param startLine 문장 시작 라인 (1-based)
 * @returns global 위치
 */
function toGlobalLocation(
  location: DdlDiagnostic['location'] | undefined,
  startLine: number,
): DdlDiagnostic['location'] | undefined {
  if (!location) {
    return undefined;
  }

  return {
    line: startLine + location.line - 1,
    startColumn: location.startColumn,
    endColumn: location.endColumn,
  };
}

/**
 * DDL 파싱 오류 메시지를 진단 객체로 만든다.
 *
 * @param details  에러 상세 문자열
 * @param location 선택적 위치 정보
 * @returns DdlDiagnostic
 */
function createParseDiagnostic(
  details: string,
  location?: DdlDiagnostic['location'],
): DdlDiagnostic {
  return {
    messageKey: 'erd.ddlImport.parseErrorDetails',
    messageArgs: { details },
    severity: 'error',
    location,
  };
}

/**
 * 문장 단위 파싱 오류를 사용자 표시용 문자열로 정규화한다.
 *
 * @param index 문장 인덱스 (1-based)
 * @param sql   원본 문장 SQL
 * @param error 오류 객체
 * @returns 정규화된 오류 메시지
 */
function formatStatementParseError(index: number, sql: string, error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const snippet = sql.replace(/\s+/g, ' ').trim().slice(0, 120);
  return `Statement ${index}: ${msg}${snippet ? ` | ${snippet}` : ''}`;
}

/**
 * DDL 문자열을 파싱하여 테이블/관계 정보를 추출한다.
 *
 * node-sql-parser를 동적으로 로드하여 번들 사이즈를 최적화한다.
 * 부분 성공을 지원하며, 파싱 실패한 문장은 errors 배열에 추가된다.
 *
 * @param ddl  SQL DDL 문자열
 * @param dbms 대상 DBMS 타입
 * @returns 파싱 결과 (Promise)
 */
export async function parseDdl(ddl: string, dbms: DbmsType): Promise<DdlParseResult> {
  const diagnostics: DdlDiagnostic[] = [];
  const tables: ParsedTable[] = [];
  const relations: ParsedRelation[] = [];
  const errors: string[] = [];
  const tableRanges: ParsedTableRange[] = [];

  if (!ddl.trim()) {
    return { diagnostics, tables, relations, errors, tableRanges };
  }

  const normalizedDdl = normalizeDdlForParser(ddl, dbms);
  const statementChunks = splitSqlStatements(normalizedDdl);
  const coarseRanges = buildTableRangesFromChunks(statementChunks);
  const createTableStartLines = buildCreateTableStartLineMap(statementChunks);

  try {
    const { Parser } = await getParser(dbms);
    const parser = new Parser();
    const database = mapDbmsToParserDb(dbms);

    // AST 한 건을 안전하게 처리하고 실패 시 context와 함께 errors에 기록한다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processAstSafely = (ast: any, context: string) => {
      try {
        if (ast.type === 'create' && ast.keyword === 'table') {
          const result = processCreateTable(ast);
          tables.push(result.table);
          relations.push(...result.relations);
        } else if (ast.type === 'alter') {
          const alterRelations = processAlterTable(ast);
          relations.push(...alterRelations);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const details = `${context}: ${msg}`;
        errors.push(details);
        diagnostics.push(createParseDiagnostic(details));
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let astResult: any;
    try {
      astResult = parser.astify(normalizedDdl, {
        database,
        parseOptions: { includeLocations: true },
      });
      const astArray = Array.isArray(astResult) ? astResult : [astResult];
      for (let i = 0; i < astArray.length; i++) {
        processAstSafely(astArray[i], `Statement ${i + 1}`);
      }
    } catch (fullParseError) {
      const fullMessage =
        fullParseError instanceof Error ? fullParseError.message : String(fullParseError);
      const fullDetails = `Full script parse failed: ${fullMessage}`;
      const fullLocation = extractParserErrorLocation(fullParseError);
      const statementErrors: string[] = [];
      const statementDiagnostics: DdlDiagnostic[] = [];

      // 전체 스크립트 파싱 실패 시 문장 단위로 재시도하여 원인 위치를 좁힌다.
      const chunks = splitSqlStatements(normalizedDdl);
      if (chunks.length > 1) {
        for (const chunk of chunks) {
          try {
            const statementAst = parser.astify(chunk.sql, {
              database,
              parseOptions: { includeLocations: true },
            });
            const astArray = Array.isArray(statementAst) ? statementAst : [statementAst];
            for (const ast of astArray) {
              processAstSafely(ast, `Statement ${chunk.index}`);
            }
          } catch (statementError) {
            const details = formatStatementParseError(chunk.index, chunk.sql, statementError);
            statementErrors.push(details);
            const localLocation = extractParserErrorLocation(statementError);
            statementDiagnostics.push(
              createParseDiagnostic(details, toGlobalLocation(localLocation, chunk.startLine)),
            );
          }
        }
      }

      if (statementDiagnostics.length > 0) {
        errors.push(...statementErrors);
        diagnostics.push(...statementDiagnostics);
      } else {
        errors.push(fullDetails);
        diagnostics.push(createParseDiagnostic(fullDetails, fullLocation));
      }
    }

    // COMMENT ON TABLE/COLUMN 후처리 (정규식 기반)
    const { tableComments, columnComments } = extractCommentStatements(ddl);

    for (const table of tables) {
      if (!table.comment && tableComments.has(table.name)) {
        table.comment = tableComments.get(table.name);
      }

      for (const col of table.columns) {
        const key = `${table.name}.${col.name}`;
        if (!col.comment && columnComments.has(key)) {
          col.comment = columnComments.get(key);
        }
      }
    }

    // 테이블 내 중복 컬럼명(대소문자 무시) 진단
    for (const table of tables) {
      const seenPhysical = new Map<string, { name: string; line: number }>();
      const seenLogical = new Map<string, { name: string; line: number }>();
      const tableStartLine = createTableStartLines.get(table.name.toLowerCase());

      for (let idx = 0; idx < table.columns.length; idx++) {
        const col = table.columns[idx];
        const colPhysicalKey = col.name.toLowerCase();
        const approxLine = tableStartLine != null ? tableStartLine + idx + 1 : -1;
        const firstPhysical = seenPhysical.get(colPhysicalKey);

        if (firstPhysical) {
          diagnostics.push({
            messageKey: 'erd.ddlImport.duplicateColumnInTable',
            messageArgs: {
              table: table.name,
              column: col.name,
              firstLine: firstPhysical.line > 0 ? String(firstPhysical.line) : '?',
            },
            severity: 'error',
            location:
              approxLine > 0
                ? {
                    line: approxLine,
                    startColumn: 1,
                    endColumn: 2,
                  }
                : undefined,
          });
          errors.push(`Duplicate column in table ${table.name}: ${col.name}`);
        } else {
          seenPhysical.set(colPhysicalKey, { name: col.name, line: approxLine });
        }

        const logicalName = (col.logicalName ?? col.comment)?.trim();
        if (!logicalName) {
          continue;
        }
        const normalizedLogical = logicalName.toLowerCase();
        const firstLogical = seenLogical.get(normalizedLogical);
        if (firstLogical) {
          diagnostics.push({
            messageKey: 'erd.ddlImport.duplicateLogicalColumnInTable',
            messageArgs: {
              table: table.name,
              logicalName,
              firstLine: firstLogical.line > 0 ? String(firstLogical.line) : '?',
            },
            severity: 'error',
            location:
              approxLine > 0
                ? {
                    line: approxLine,
                    startColumn: 1,
                    endColumn: 2,
                  }
                : undefined,
          });
          errors.push(`Duplicate logical column in table ${table.name}: ${logicalName}`);
          continue;
        }

        seenLogical.set(normalizedLogical, { name: logicalName, line: approxLine });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const details = `DDL parser load failed: ${msg}`;
    errors.push(details);
    diagnostics.push(createParseDiagnostic(details));
  }

  // 파싱 성공 시 추출된 테이블 구조를 반영한 키로 coarse range를 보강한다.
  const lockKeyByTableName = new Map<string, string>();
  for (const table of tables) {
    lockKeyByTableName.set(
      table.name.toLowerCase(),
      buildTableLockKey({
        logicalName: table.logicalTableName ?? table.comment,
        physicalName: table.name,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          pk: column.pk,
          fk: false,
        })),
      }),
    );
  }

  for (const range of coarseRanges) {
    const refinedKey = lockKeyByTableName.get(range.tableNameLower) ?? range.tableKey;
    tableRanges.push({
      tableKey: refinedKey,
      startLine: range.startLine,
      endLine: range.endLine,
    });
  }

  return { diagnostics, tables, relations, errors, tableRanges };
}
