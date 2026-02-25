/** DSL 테이블 선언 키워드 */
export const DSL_TABLE_KEYWORD = 'Table';

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
