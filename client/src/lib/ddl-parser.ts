import type { DbmsType } from '@/types/erd';

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
  /** 파싱된 테이블 목록 */
  tables: ParsedTable[];
  /** 파싱된 FK 관계 목록 */
  relations: ParsedRelation[];
  /** 파싱 중 발생한 에러 메시지 목록 */
  errors: string[];
}

/**
 * node-sql-parser 모듈 캐시 (최초 1회만 동적 import하여 저장).
 *
 * 모듈 스코프 — 비직렬화 가능한 모듈 참조이므로 Zustand에 저장할 수 없다.
 * JavaScript 단일 스레드 특성상 race condition은 발생하지 않는다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let parserModule: any = null;

/**
 * node-sql-parser 모듈을 동적으로 로드한다 (최초 1회만).
 * 번들 사이즈 최적화를 위해 dynamic import를 사용한다.
 *
 * @returns node-sql-parser 모듈
 */
async function getParser(): Promise<{ Parser: new () => ParserInstance }> {
  if (!parserModule) {
    parserModule = await import('node-sql-parser');
  }
  return parserModule;
}

/** node-sql-parser의 Parser 인스턴스 인터페이스 */
interface ParserInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  astify(sql: string, options?: { database?: string }): any;
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
  if (value == null) return [];
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
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);

  if (typeof value.name === 'string') return value.name;
  if (typeof value.column === 'string') return value.column;
  if (typeof value.table === 'string') return value.table;
  if (typeof value.value === 'string') return value.value;

  const nestedCandidates = [value.expr, value.column, value.table, value.value, value.name];
  for (const nested of nestedCandidates) {
    const extracted = extractIdentifier(nested, seen);
    if (extracted) return extracted;
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
    if (name) return name;
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
  if (!definition?.dataType) return 'VARCHAR(255)';

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
  if (definition?.auto_increment) return true;

  const upper = dataType.toUpperCase();
  if (upper === 'SERIAL' || upper === 'BIGSERIAL' || upper === 'SMALLSERIAL') return true;

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
  if (!definition?.nullable) return true;
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
    '',
  );

  return normalized;
}

/** 문장 분해 결과 */
interface SqlStatementChunk {
  /** 1-based 문장 인덱스 */
  index: number;
  /** 문장 SQL */
  sql: string;
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
  let start = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  const pushChunk = (end: number) => {
    const sql = ddl.slice(start, end).trim();
    if (sql) {
      chunks.push({ index: chunks.length + 1, sql });
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
  const tables: ParsedTable[] = [];
  const relations: ParsedRelation[] = [];
  const errors: string[] = [];

  if (!ddl.trim()) {
    return { tables, relations, errors };
  }

  const normalizedDdl = normalizeDdlForParser(ddl, dbms);

  try {
    const { Parser } = await getParser();
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
        errors.push(`${context}: ${msg}`);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let astResult: any;
    try {
      astResult = parser.astify(normalizedDdl, { database });
      const astArray = Array.isArray(astResult) ? astResult : [astResult];
      for (let i = 0; i < astArray.length; i++) {
        processAstSafely(astArray[i], `Statement ${i + 1}`);
      }
    } catch (fullParseError) {
      const fullMessage =
        fullParseError instanceof Error ? fullParseError.message : String(fullParseError);
      errors.push(`Full script parse failed: ${fullMessage}`);

      // 전체 스크립트 파싱 실패 시 문장 단위로 재시도하여 원인 위치를 좁힌다.
      const chunks = splitSqlStatements(normalizedDdl);
      if (chunks.length > 1) {
        for (const chunk of chunks) {
          try {
            const statementAst = parser.astify(chunk.sql, { database });
            const astArray = Array.isArray(statementAst) ? statementAst : [statementAst];
            for (const ast of astArray) {
              processAstSafely(ast, `Statement ${chunk.index}`);
            }
          } catch (statementError) {
            errors.push(formatStatementParseError(chunk.index, chunk.sql, statementError));
          }
        }
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`DDL parser load failed: ${msg}`);
  }

  return { tables, relations, errors };
}
