/** DSL 테이블 선언 키워드 */
export const DSL_TABLE_KEYWORD = 'Table';

/** DSL 컬럼 옵션 키워드 */
export const DSL_COLUMN_OPTIONS = ['PK', 'AI', 'NN'] as const;

/** DSL 옵션 키워드 타입 */
export type DslColumnOption = (typeof DSL_COLUMN_OPTIONS)[number];
