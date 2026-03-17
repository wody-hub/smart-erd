import type { DdlParseResult } from './ddl-parser.js';
import { sortObjectKeys } from './code-sync-revision.js';
import { djb2 } from './hash.js';

/**
 * 코드 자동반영 비교용 컬럼 스냅샷을 정규화한다.
 *
 * @param column 파싱된 컬럼 정보
 * @returns 의미 기반 컬럼 스냅샷
 */
function sanitizeParsedColumn(column: DdlParseResult['tables'][number]['columns'][number]) {
  return {
    name: column.name,
    type: column.type,
    pk: column.pk,
    nullable: column.nullable,
    autoIncrement: column.autoIncrement,
    logicalName: column.logicalName ?? column.comment ?? null,
    termId: column.termId ?? null,
    domainId: column.domainId ?? null,
  };
}

/**
 * 파싱 결과를 결정적 스키마 해시로 변환한다.
 *
 * 주석/포맷 변화처럼 스키마에 영향 없는 수정은 제외하고
 * table/column/relation 구조만 비교 대상으로 사용한다.
 *
 * @param result 파싱 결과
 * @returns 결정적 스키마 해시
 */
export function buildParsedSchemaHash(result: DdlParseResult): string {
  const payload = {
    tables: [...result.tables]
      .map((table) => ({
        name: table.name,
        logicalTableName: table.logicalTableName ?? table.comment ?? null,
        tableTermId: table.tableTermId ?? null,
        columns: [...table.columns]
          .map((column) => sanitizeParsedColumn(column))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    relations: [...result.relations]
      .map((relation) => ({
        parentTable: relation.parentTable,
        parentColumn: relation.parentColumn,
        childTable: relation.childTable,
        childColumn: relation.childColumn,
      }))
      .sort((a, b) =>
        `${a.parentTable}.${a.parentColumn}->${a.childTable}.${a.childColumn}`.localeCompare(
          `${b.parentTable}.${b.parentColumn}->${b.childTable}.${b.childColumn}`,
        ),
      ),
  };

  return djb2(JSON.stringify(sortObjectKeys(payload)));
}
