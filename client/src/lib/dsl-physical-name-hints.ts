import type { TableNode } from '../types/erd.js';
import type { DslPhysicalNameHint } from './dsl-parser.js';

/** 테이블 물리명 source entry 접두사 */
const TABLE_SOURCE_ENTRY = 'table';
/** 컬럼 물리명 source entry 접두사 */
const COLUMN_SOURCE_ENTRY = 'column';
/** source entry 구분자 */
const SOURCE_ENTRY_SEPARATOR = '\t';

/**
 * ERD 노드에서 물리명 힌트 source entry 목록을 만든다.
 *
 * selector에서 사용하기 위해 문자열 배열로 직렬화한다.
 * 논리명/물리명 관련 값만 포함하므로 위치 변경 같은 시각 편집은 제외된다.
 *
 * @param nodes ERD 테이블 노드 목록
 * @returns 물리명 힌트 source entry 목록
 */
export function buildErdPhysicalNameSourceEntries(nodes: TableNode[]): string[] {
  return nodes.flatMap((node) => {
    const entries: string[] = [];
    const tableLogicalName = node.data.logicalTableName?.trim();
    const tablePhysicalName = node.data.label?.trim();

    if (tableLogicalName && tablePhysicalName) {
      entries.push(
        [TABLE_SOURCE_ENTRY, tableLogicalName, tablePhysicalName].join(SOURCE_ENTRY_SEPARATOR),
      );
    }

    if (!tableLogicalName) {
      return entries;
    }

    for (const column of node.data.columns) {
      const columnLogicalName = column.logicalName?.trim();
      const columnPhysicalName = column.name?.trim();
      if (!columnLogicalName || !columnPhysicalName) {
        continue;
      }

      entries.push(
        [
          COLUMN_SOURCE_ENTRY,
          tableLogicalName,
          columnLogicalName,
          columnPhysicalName,
        ].join(SOURCE_ENTRY_SEPARATOR),
      );
    }

    return entries;
  });
}

/**
 * source entry 목록에서 유일한 물리명 매핑만 추출한다.
 *
 * 동일 key에 여러 물리명이 있으면 ambiguous 로 간주하고 결과에서 제외한다.
 *
 * @param sourceEntries ERD 물리명 source entry 목록
 * @returns 테이블/컬럼 유일 매핑
 */
function resolveUniquePhysicalNameMaps(sourceEntries: readonly string[]): {
  tableMap: Map<string, string>;
  columnMap: Map<string, string>;
} {
  const tableMap = new Map<string, string>();
  const columnMap = new Map<string, string>();
  const ambiguousTables = new Set<string>();
  const ambiguousColumns = new Set<string>();

  for (const entry of sourceEntries) {
    const parts = entry.split(SOURCE_ENTRY_SEPARATOR);
    if (parts[0] === TABLE_SOURCE_ENTRY) {
      const logicalName = parts[1]?.trim();
      const physicalName = parts[2]?.trim();
      if (!logicalName || !physicalName || ambiguousTables.has(logicalName)) {
        continue;
      }
      const current = tableMap.get(logicalName);
      if (current && current !== physicalName) {
        tableMap.delete(logicalName);
        ambiguousTables.add(logicalName);
        continue;
      }
      tableMap.set(logicalName, physicalName);
      continue;
    }

    if (parts[0] === COLUMN_SOURCE_ENTRY) {
      const tableLogicalName = parts[1]?.trim();
      const logicalName = parts[2]?.trim();
      const physicalName = parts[3]?.trim();
      if (!tableLogicalName || !logicalName || !physicalName) {
        continue;
      }

      const columnKey = `${tableLogicalName}::${logicalName}`;
      if (ambiguousColumns.has(columnKey)) {
        continue;
      }

      const current = columnMap.get(columnKey);
      if (current && current !== physicalName) {
        columnMap.delete(columnKey);
        ambiguousColumns.add(columnKey);
        continue;
      }
      columnMap.set(columnKey, physicalName);
    }
  }

  return { tableMap, columnMap };
}

/**
 * 파서 힌트와 현재 ERD 물리명을 합쳐 화면 표시용 힌트를 만든다.
 *
 * ERD에서 유일하게 식별되는 물리명이 있으면 그것을 우선 사용하고,
 * ambiguous 하면 parser fallback 을 사용한다. 최종 물리명이 논리명과 같으면 힌트를 숨긴다.
 *
 * @param parsedHints parser가 제공한 위치/논리명 힌트
 * @param sourceEntries 현재 ERD 노드에서 만든 물리명 source entry 목록
 * @returns 화면 표시용 힌트 목록
 */
export function buildDslPhysicalNameHints(
  parsedHints: readonly DslPhysicalNameHint[],
  sourceEntries: readonly string[],
): DslPhysicalNameHint[] {
  const { tableMap, columnMap } = resolveUniquePhysicalNameMaps(sourceEntries);

  return parsedHints
    .map((hint) => {
      const physicalName =
        hint.kind === 'table'
          ? tableMap.get(hint.logicalName) ?? hint.physicalName
          : columnMap.get(`${hint.tableLogicalName ?? ''}::${hint.logicalName}`) ?? hint.physicalName;

      return {
        ...hint,
        physicalName,
      };
    })
    .filter((hint) => hint.physicalName.trim().length > 0 && hint.physicalName !== hint.logicalName);
}
