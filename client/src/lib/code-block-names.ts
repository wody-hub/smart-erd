import { normalizeBlockDisplayName } from './dsl-block-display.js';

/** 병합 결과의 중복 물리명과 영향을 받는 안정 컬럼 ID. */
export interface DuplicateColumnName {
  name: string;
  columnIds: string[];
}

/** 컬럼 이름 검증과 같은 대소문자 규칙으로 중복을 결정적 순서로 반환한다. */
export function duplicateColumnNames(
  columns: readonly { id: string; name: string }[],
): DuplicateColumnName[] {
  const groups = new Map<string, { names: string[]; columnIds: string[] }>();
  for (const column of columns) {
    const key = column.name.toLowerCase();
    const group = groups.get(key) ?? { names: [], columnIds: [] };
    group.names.push(column.name);
    group.columnIds.push(column.id);
    groups.set(key, group);
  }
  return [...groups]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .filter(([, group]) => group.columnIds.length > 1)
    .map(([, group]) => ({
      name: [...new Set(group.names)].sort().join(' / '),
      columnIds: group.columnIds.sort(),
    }));
}

/** 물리명과 실제 DSL 선언·FK 이름을 각각 독립된 이름 공간에서 검사한다. */
export function tableNameCollision(
  candidate: { label: string; logicalTableName?: string | null },
  others: Iterable<{ label: string; logicalTableName?: string | null }>,
): boolean {
  const physical = normalizeBlockDisplayName(candidate.label).trim();
  const declared = normalizeBlockDisplayName(candidate.logicalTableName || candidate.label).trim();
  return [...others].some(
    (table) =>
      normalizeBlockDisplayName(table.label).trim() === physical ||
      normalizeBlockDisplayName(table.logicalTableName || table.label).trim() === declared,
  );
}
