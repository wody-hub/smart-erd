import { getColumnYMap } from '@/collaboration/yjs-columns';
import * as Y from 'yjs';

function sanitizeTableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * 기존 배열 인자를 유지하면서 이관된 컬럼 본체를 우선 조회한다.
 * @param colsYArray 레거시 컬럼 배열
 * @param colId 컬럼 ID
 * @returns 현재 컬럼 본체 또는 undefined
 */
export function findColumnYMap(
  colsYArray: Y.Array<Y.Map<unknown>>,
  colId: string,
): Y.Map<unknown> | undefined {
  if (colsYArray.parent instanceof Y.Map) {
    return getColumnYMap(colsYArray.parent, colId);
  }
  for (let index = 0; index < colsYArray.length; index += 1) {
    const candidate = colsYArray.get(index);
    if (candidate.get('id') === colId) {
      return candidate;
    }
  }
  return undefined;
}

export function buildUniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) {
    return base;
  }
  let suffix = 1;
  while (existing.includes(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

export function buildFkPrefix(parentLabel: string): string {
  return sanitizeTableName(parentLabel);
}

export function buildUniqueFkColumnName(baseName: string, existingNames: string[]): string {
  return buildUniqueName(baseName, existingNames);
}

export function resolveUniqueTableLabel(
  tablesMap: Y.Map<Y.Map<unknown>>,
  tableId: string,
  nextLabel: string,
): string {
  const existingLabels: string[] = [];
  tablesMap.forEach((table, existingTableId) => {
    if (existingTableId === tableId) {
      return;
    }
    const label = table.get('label');
    if (typeof label === 'string' && label.length > 0) {
      existingLabels.push(label);
    }
  });
  return buildUniqueName(nextLabel, existingLabels);
}
