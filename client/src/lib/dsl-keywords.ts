/** DSL 테이블 선언 키워드 */
export const DSL_TABLE_KEYWORD = 'Table';

/** `Table ` 뒤 컨텍스트 감지 정규식 */
export const DSL_TABLE_AFTER_REGEX = new RegExp(`^\\s*${DSL_TABLE_KEYWORD}\\s+[^{}]*$`);
/** `Table ` 뒤 입력 구간 캡처 정규식 */
export const DSL_TABLE_TERM_CAPTURE_REGEX = new RegExp(`^\\s*${DSL_TABLE_KEYWORD}\\s+([^{}]*)$`);
/** Table 키워드 행 시작 감지 정규식 (블록 판정용) */
export const DSL_TABLE_LINE_REGEX = new RegExp(`^${DSL_TABLE_KEYWORD}\\s+`);
/** 도메인 지정 컨텍스트 감지 정규식 (`:domain`) */
export const DSL_DOMAIN_CONTEXT_REGEX = /(^|[^:]):\s*[^[]*$/;
/** 도메인 입력 캡처 정규식 */
export const DSL_DOMAIN_CAPTURE_REGEX = /(^|[^:]):\s*([^[]*)$/;
/** 명시 타입 컨텍스트 감지 정규식 (`::type`) */
export const DSL_EXPLICIT_TYPE_CONTEXT_REGEX = /::\s*[^[]*$/;
/** FK 컨텍스트 감지 정규식 (`> table.column`) */
export const DSL_FK_CONTEXT_REGEX = />\s*.*$/;
/** FK 입력 캡처 정규식 */
export const DSL_FK_CAPTURE_REGEX = />\s*(.*)$/;
/** 테이블 블록 내부 컬럼 논리명 입력 캡처 정규식 */
export const DSL_BLOCK_TERM_CAPTURE_REGEX = /^\s*([^>:[\]]*)$/;

/** DSL 컬럼 옵션 키워드 */
export const DSL_COLUMN_OPTIONS = ['PK', 'AI', 'NN'] as const;

/** DSL 타입 추천 목록 */
export const DSL_TYPE_SUGGESTIONS = [
  'VARCHAR(255)',
  'VARCHAR(500)',
  'CHAR(1)',
  'TEXT',
  'BIGINT',
  'INTEGER',
  'SMALLINT',
  'BOOLEAN',
  'UUID',
  'TIMESTAMP',
  'TIMESTAMP WITH TIME ZONE',
  'DATETIME',
  'TIME',
  'DATE',
  'DECIMAL(19,4)',
  'NUMERIC(10,2)',
  'JSON',
  'JSONB',
  'BYTEA',
  'BLOB',
] as const;

/** DSL 옵션 키워드 타입 */
export type DslColumnOption = (typeof DSL_COLUMN_OPTIONS)[number];

/** DSL 타입 추천 문자열 타입 */
export type DslTypeSuggestion = (typeof DSL_TYPE_SUGGESTIONS)[number];
