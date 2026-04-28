import type { CreateWbsItemPayload, ReorderWbsPayload, WbsItem } from '@/types/wbs';

/** 루트 부모 키 (부모가 null인 항목의 맵 키). */
export const ROOT_PARENT_KEY = '__root__';
/** WBS 최대 트리 깊이 (0~8). */
export const MAX_WBS_DEPTH = 8;
/** 트리 깊이당 좌측 들여쓰기(px). */
export const TREE_INDENT = 16;
/** 드래그 시 수평 이동 20px당 깊이 1단계 변경. */
export const DRAG_DEPTH_OFFSET = 20;

export type ParentKey = number | typeof ROOT_PARENT_KEY;

/**
 * 부모 ID를 맵 키 형식으로 변환한다.
 *
 * @param parentId 부모 ID
 * @returns 부모 키
 */
export function toParentKey(parentId: number | null): ParentKey {
  return parentId ?? ROOT_PARENT_KEY;
}

/**
 * WBS 정렬 비교 함수를 제공한다.
 *
 * @param left 좌측 항목
 * @param right 우측 항목
 * @returns 정렬 우선순위
 */
function compareBySortOrder(left: WbsItem, right: WbsItem): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }
  return left.id - right.id;
}

/**
 * 부모 기준 자식 맵을 구성한다.
 *
 * @param items 전체 WBS 항목
 * @returns 부모별 자식 맵
 */
export function buildChildrenByParent(items: WbsItem[]): Map<ParentKey, WbsItem[]> {
  const childrenByParent = new Map<ParentKey, WbsItem[]>();
  childrenByParent.set(ROOT_PARENT_KEY, []);

  items.forEach((item) => {
    const key = toParentKey(item.parentId);
    const current = childrenByParent.get(key) ?? [];
    current.push(item);
    childrenByParent.set(key, current);
  });

  childrenByParent.forEach((children) => {
    children.sort(compareBySortOrder);
  });

  return childrenByParent;
}

/**
 * 트리를 평면 목록으로 전개한다.
 *
 * @param childrenByParent 부모별 자식 맵
 * @param collapsedIds 접힌 항목 ID 집합
 * @returns 렌더링 순서 목록
 */
export function flattenTreeItems(
  childrenByParent: Map<ParentKey, WbsItem[]>,
  collapsedIds: Set<number>,
): WbsItem[] {
  const ordered: WbsItem[] = [];

  const visit = (parentKey: ParentKey) => {
    const children = childrenByParent.get(parentKey) ?? [];
    children.forEach((child) => {
      ordered.push(child);
      if (!collapsedIds.has(child.id)) {
        visit(child.id);
      }
    });
  };

  visit(ROOT_PARENT_KEY);
  return ordered;
}

/**
 * 특정 WBS 항목의 모든 하위 항목 ID 집합을 계산한다.
 * childrenByParent 맵이 있으면 그대로 사용하고, 없으면 items 배열에서 구성한다.
 *
 * @param sourceId 기준 항목 ID
 * @param itemsOrMap 전체 WBS 항목 배열 또는 부모별 자식 맵
 * @returns 하위 항목 ID 집합
 */
export function collectDescendantIds(
  sourceId: number,
  itemsOrMap: WbsItem[] | Map<ParentKey, WbsItem[]>,
): Set<number> {
  const childrenByParent: Map<ParentKey, WbsItem[]> = Array.isArray(itemsOrMap)
    ? buildChildrenByParent(itemsOrMap)
    : itemsOrMap;

  const descendants = new Set<number>();
  const stack = [...(childrenByParent.get(sourceId) ?? [])];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || descendants.has(current.id)) {
      continue;
    }
    descendants.add(current.id);
    (childrenByParent.get(current.id) ?? []).forEach((child) => stack.push(child));
  }

  return descendants;
}

/**
 * 하위 트리의 최대 깊이 증가량을 계산한다.
 *
 * @param sourceId 기준 항목 ID
 * @param itemById 항목 맵
 * @param childrenByParent 부모별 자식 맵
 * @returns 하위 트리 최대 깊이 증가량
 */
export function getMaxDescendantDepthOffset(
  sourceId: number,
  itemById: Map<number, WbsItem>,
  childrenByParent: Map<ParentKey, WbsItem[]>,
): number {
  const source = itemById.get(sourceId);
  if (!source) {
    return 0;
  }

  let maxDepthOffset = 0;
  const stack = [...(childrenByParent.get(sourceId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    maxDepthOffset = Math.max(maxDepthOffset, current.depth - source.depth);
    (childrenByParent.get(current.id) ?? []).forEach((child) => stack.push(child));
  }
  return maxDepthOffset;
}

/** 드래그 완료 시 예상 배치 결과. */
export interface ProjectedPlacement {
  /** 예상 깊이 */
  depth: number;
  /** 예상 부모 ID */
  parentId: number | null;
}

/** projectPlacement 입력값. */
export interface ProjectPlacementInput {
  /** 이동 후 가시 항목 배열 */
  movedVisibleItems: WbsItem[];
  /** 드래그 대상 항목 */
  activeItem: WbsItem;
  /** 드롭 위치 인덱스 */
  overIndex: number;
  /** 수평 드래그 오프셋 */
  dragOffsetX: number;
}

/**
 * 숫자를 범위 내로 제한한다.
 *
 * @param value 입력 숫자
 * @param min 최소값
 * @param max 최대값
 * @returns 범위 제한 숫자
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 드래그 완료 시 예상 부모/깊이를 계산한다.
 *
 * @param input 투영 계산 입력값
 * @returns 예상 부모/깊이
 */
export function projectPlacement(input: ProjectPlacementInput): ProjectedPlacement {
  const { movedVisibleItems, activeItem, overIndex, dragOffsetX } = input;
  const previousItem = movedVisibleItems[overIndex - 1];
  const nextItem = movedVisibleItems[overIndex + 1];

  const projectedDepth = activeItem.depth + Math.round(dragOffsetX / DRAG_DEPTH_OFFSET);
  const maxDepth = previousItem ? Math.min(MAX_WBS_DEPTH, previousItem.depth + 1) : 0;
  const minDepth = nextItem ? Math.min(nextItem.depth, MAX_WBS_DEPTH) : 0;
  const nextDepth = clamp(projectedDepth, minDepth, maxDepth);

  if (nextDepth === 0 || !previousItem) {
    return { depth: 0, parentId: null };
  }

  if (nextDepth > previousItem.depth) {
    return { depth: nextDepth, parentId: previousItem.id };
  }

  if (nextDepth === previousItem.depth) {
    return { depth: nextDepth, parentId: previousItem.parentId };
  }

  for (let index = overIndex - 1; index >= 0; index -= 1) {
    const candidate = movedVisibleItems[index];
    if (candidate.depth === nextDepth - 1) {
      return { depth: nextDepth, parentId: candidate.id };
    }
  }

  return { depth: nextDepth, parentId: null };
}

/** buildReorderPayload 입력값. */
export interface BuildReorderPayloadInput {
  /** 전체 WBS 항목 */
  allItems: WbsItem[];
  /** 부모별 자식 맵 */
  childrenByParent: Map<ParentKey, WbsItem[]>;
  /** 이동 후 가시 항목 배열 */
  movedVisibleItems: WbsItem[];
  /** 드래그 대상 항목 ID */
  activeItemId: number;
  /** 이전 부모 ID */
  previousParentId: number | null;
  /** 다음 부모 ID */
  nextParentId: number | null;
  /** 다음 깊이 */
  nextDepth: number;
}

/** buildTargetIndexReorderPayload 입력값. */
export interface BuildTargetIndexReorderPayloadInput {
  /** 전체 WBS 항목 */
  allItems: WbsItem[];
  /** 부모별 자식 맵 */
  childrenByParent: Map<ParentKey, WbsItem[]>;
  /** 이동 대상 항목 ID */
  activeItemId: number;
  /** 이동 후 부모 ID */
  nextParentId: number | null;
  /** 이동 후 sibling 내 index */
  targetIndex: number;
}

/** 이동 검증 오류 코드. */
export type MoveValidationError = 'invalidMove' | 'depthLimitExceeded';

/** resolveMoveValidationError 입력값. */
export interface ResolveMoveValidationErrorInput {
  /** 이동 대상 항목 ID */
  activeItemId: number;
  /** 이동 후 부모 ID */
  nextParentId: number | null;
  /** 항목 ID 맵 */
  itemById: Map<number, WbsItem>;
  /** 부모별 자식 맵 */
  childrenByParent: Map<ParentKey, WbsItem[]>;
}

/**
 * 드래그 결과를 reorder API payload로 변환한다.
 *
 * @param input payload 구성 입력값
 * @returns reorder payload
 */
export function buildReorderPayload(input: BuildReorderPayloadInput): ReorderWbsPayload {
  const {
    allItems,
    childrenByParent,
    movedVisibleItems,
    activeItemId,
    previousParentId,
    nextParentId,
    nextDepth,
  } = input;
  const previousKey = toParentKey(previousParentId);
  const nextKey = toParentKey(nextParentId);
  const activeItem = allItems.find((item) => item.id === activeItemId);
  if (!activeItem) {
    return { items: [] };
  }
  const originalById = new Map(allItems.map((item) => [item.id, item]));
  const affectedParentKeys = new Set<ParentKey>([previousKey, nextKey]);

  const siblingsByParent = new Map<ParentKey, WbsItem[]>();
  childrenByParent.forEach((siblings, key) => {
    siblingsByParent.set(key, [...siblings]);
  });

  const previousSiblings = (siblingsByParent.get(previousKey) ?? []).filter(
    (item) => item.id !== activeItemId,
  );
  siblingsByParent.set(previousKey, previousSiblings);

  const currentTargetSiblings =
    previousKey === nextKey
      ? previousSiblings
      : [...(siblingsByParent.get(nextKey) ?? []).filter((item) => item.id !== activeItemId)];
  const activeVisibleIndex = movedVisibleItems.findIndex((item) => item.id === activeItemId);

  let nextSiblingId: number | null = null;
  for (let index = activeVisibleIndex + 1; index < movedVisibleItems.length; index += 1) {
    const candidate = movedVisibleItems[index];
    if (candidate.parentId === nextParentId) {
      nextSiblingId = candidate.id;
      break;
    }
    if (candidate.depth < nextDepth) {
      break;
    }
  }

  const insertionIndex =
    nextSiblingId == null
      ? currentTargetSiblings.length
      : currentTargetSiblings.findIndex((item) => item.id === nextSiblingId);
  const targetIndex = insertionIndex < 0 ? currentTargetSiblings.length : insertionIndex;
  currentTargetSiblings.splice(targetIndex, 0, activeItem);
  siblingsByParent.set(nextKey, currentTargetSiblings);

  const payloadItems: ReorderWbsPayload['items'] = [];
  affectedParentKeys.forEach((parentKey) => {
    const siblings = siblingsByParent.get(parentKey) ?? [];
    siblings.forEach((item, sortOrder) => {
      const parentId = parentKey === ROOT_PARENT_KEY ? null : parentKey;
      const original = originalById.get(item.id);
      if (original && original.parentId === parentId && original.sortOrder === sortOrder) {
        return;
      }
      payloadItems.push({
        id: item.id,
        parentId,
        sortOrder,
      });
    });
  });

  return { items: payloadItems };
}

/**
 * 명시적 부모/위치 선택 결과를 reorder API payload로 변환한다.
 *
 * @param input payload 구성 입력값
 * @returns reorder payload
 */
export function buildTargetIndexReorderPayload(
  input: BuildTargetIndexReorderPayloadInput,
): ReorderWbsPayload {
  const { allItems, childrenByParent, activeItemId, nextParentId, targetIndex } = input;
  const activeItem = allItems.find((item) => item.id === activeItemId);
  if (!activeItem) {
    return { items: [] };
  }

  const previousKey = toParentKey(activeItem.parentId);
  const nextKey = toParentKey(nextParentId);
  const affectedParentKeys = new Set<ParentKey>([previousKey, nextKey]);
  const originalById = new Map(allItems.map((item) => [item.id, item]));

  const siblingsByParent = new Map<ParentKey, WbsItem[]>();
  childrenByParent.forEach((siblings, key) => {
    siblingsByParent.set(key, [...siblings]);
  });

  const previousSiblings = (siblingsByParent.get(previousKey) ?? []).filter(
    (item) => item.id !== activeItemId,
  );
  siblingsByParent.set(previousKey, previousSiblings);

  const nextSiblings =
    previousKey === nextKey
      ? previousSiblings
      : [...(siblingsByParent.get(nextKey) ?? []).filter((item) => item.id !== activeItemId)];
  const normalizedTargetIndex = clamp(targetIndex, 0, nextSiblings.length);

  nextSiblings.splice(normalizedTargetIndex, 0, activeItem);
  siblingsByParent.set(nextKey, nextSiblings);

  const payloadItems: ReorderWbsPayload['items'] = [];
  affectedParentKeys.forEach((parentKey) => {
    const siblings = siblingsByParent.get(parentKey) ?? [];
    siblings.forEach((item, sortOrder) => {
      const parentId = parentKey === ROOT_PARENT_KEY ? null : parentKey;
      const original = originalById.get(item.id);
      if (original && original.parentId === parentId && original.sortOrder === sortOrder) {
        return;
      }
      payloadItems.push({
        id: item.id,
        parentId,
        sortOrder,
      });
    });
  });

  return { items: payloadItems };
}

/**
 * 이동 대상 부모가 유효한지 검증한다.
 *
 * @param input 이동 검증 입력값
 * @returns 검증 오류 코드 또는 null
 */
export function resolveMoveValidationError(
  input: ResolveMoveValidationErrorInput,
): MoveValidationError | null {
  const { activeItemId, nextParentId, itemById, childrenByParent } = input;
  if (nextParentId == null) {
    return null;
  }

  const descendants = collectDescendantIds(activeItemId, childrenByParent);
  if (descendants.has(nextParentId)) {
    return 'invalidMove';
  }

  const maxDepthOffset = getMaxDescendantDepthOffset(activeItemId, itemById, childrenByParent);
  const nextDepth = (itemById.get(nextParentId)?.depth ?? -1) + 1;
  if (nextDepth < 0 || nextDepth + maxDepthOffset > MAX_WBS_DEPTH) {
    return 'depthLimitExceeded';
  }

  return null;
}

/** inline quick-add row 종류. */
export type InlineCreatePlacementKind = 'root' | 'child';

/** inline quick-add row 배치 정보. */
export interface InlineCreatePlacement {
  /** row를 붙일 기준 항목 ID. 루트 row는 null */
  afterItemId: number | null;
  /** 생성 시 사용할 부모 ID */
  parentId: number | null;
  /** 새 항목이 들어갈 깊이 */
  depth: number;
  /** row 종류 */
  kind: InlineCreatePlacementKind;
}

/** buildInlineCreatePlacements 입력값. */
export interface BuildInlineCreatePlacementsInput {
  /** 현재 보이는 WBS 항목 목록 */
  visibleItems: WbsItem[];
  /** 자식 존재 여부 맵 */
  hasChildrenById: Map<number, boolean>;
  /** 접힌 항목 ID 집합 */
  collapsedIds: Set<number>;
}

/**
 * 특정 visible subtree의 마지막 descendant index를 찾는다.
 *
 * @param visibleItems 현재 보이는 항목 목록
 * @param startIndex subtree 시작 index
 * @returns 마지막 descendant index
 */
function findLastVisibleDescendantIndex(visibleItems: WbsItem[], startIndex: number): number {
  const source = visibleItems[startIndex];
  if (!source) {
    return startIndex;
  }

  let index = startIndex;
  while (index + 1 < visibleItems.length) {
    const nextItem = visibleItems[index + 1];
    if (!nextItem || nextItem.depth <= source.depth) {
      break;
    }
    index += 1;
  }

  return index;
}

/**
 * dedicated WBS workspace의 inline quick-add row 배치를 계산한다.
 *
 * - child row는 현재 subtree의 마지막 visible row 뒤에 붙는다
 * - 자식이 있는 접힌 항목 아래에는 child row를 노출하지 않는다
 * - root row는 항상 가장 마지막에 붙는다
 *
 * @param input 배치 계산 입력값
 * @returns inline quick-add row 목록
 */
export function buildInlineCreatePlacements(
  input: BuildInlineCreatePlacementsInput,
): InlineCreatePlacement[] {
  const { visibleItems, hasChildrenById, collapsedIds } = input;
  const placements: InlineCreatePlacement[] = [];

  visibleItems.forEach((item, index) => {
    if (item.depth >= MAX_WBS_DEPTH) {
      return;
    }

    const hasChildren = hasChildrenById.get(item.id) === true;
    if (!hasChildren || collapsedIds.has(item.id)) {
      return;
    }

    const placementIndex = findLastVisibleDescendantIndex(visibleItems, index);
    placements.push({
      afterItemId: visibleItems[placementIndex]?.id ?? item.id,
      parentId: item.id,
      depth: item.depth + 1,
      kind: 'child',
    });
  });

  placements.push({
    afterItemId: visibleItems.length > 0 ? visibleItems[visibleItems.length - 1]!.id : null,
    parentId: null,
    depth: 0,
    kind: 'root',
  });

  return placements;
}

/**
 * dedicated inline quick-add 생성 payload를 구성한다.
 *
 * Phase 6.1 contract:
 * - assignee / dates / milestone / estimated M/M 는 비운다
 * - progressRate 는 backend implicit default에 기대지 않고 0으로 명시한다
 *
 * @param name 생성할 항목명
 * @param parentId 부모 항목 ID
 * @returns create payload
 */
export function buildInlineCreatePayload(
  name: string,
  parentId: number | null,
): CreateWbsItemPayload {
  return {
    name,
    parentId,
    assigneeUserId: null,
    startDate: null,
    endDate: null,
    progressRate: 0,
    estimatedMm: null,
    milestoneId: null,
  };
}
