import type { WbsItem } from '@/types/wbs';

export interface WbsHierarchyOption {
  itemId: number;
  itemName: string;
  fullPathLabel: string;
  ancestorPathLabel: string | null;
  searchValue: string;
}

function buildNamePath(
  item: WbsItem,
  itemById: Map<number, WbsItem>,
  cache: Map<number, string[]>,
  visiting: Set<number>,
): string[] {
  const cached = cache.get(item.id);
  if (cached) {
    return cached;
  }

  if (visiting.has(item.id)) {
    return [item.name];
  }

  visiting.add(item.id);
  const parent = item.parentId == null ? null : (itemById.get(item.parentId) ?? null);
  const path = parent
    ? [...buildNamePath(parent, itemById, cache, visiting), item.name]
    : [item.name];
  visiting.delete(item.id);
  cache.set(item.id, path);
  return path;
}

/**
 * Builds searchable WBS options with hierarchy-aware path labels.
 *
 * The input order is preserved so the picker stays aligned with the WBS tree order.
 */
export function buildWbsHierarchyOptions(items: WbsItem[]): WbsHierarchyOption[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const pathCache = new Map<number, string[]>();

  return items.map((item) => {
    const namePath = buildNamePath(item, itemById, pathCache, new Set<number>());
    const fullPathLabel = namePath.join(' / ');
    const ancestorPathLabel = namePath.length > 1 ? namePath.slice(0, -1).join(' / ') : null;

    return {
      itemId: item.id,
      itemName: item.name,
      fullPathLabel,
      ancestorPathLabel,
      searchValue: `${item.name} ${fullPathLabel}`,
    };
  });
}
