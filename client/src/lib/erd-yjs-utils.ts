import * as Y from 'yjs';

function sanitizeTableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function findColumnYMap(
  colsYArray: Y.Array<Y.Map<unknown>>,
  colId: string,
): Y.Map<unknown> | undefined {
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
