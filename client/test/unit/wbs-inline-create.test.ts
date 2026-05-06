import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInlineCreatePayload,
  buildInlineCreatePlacements,
  buildTargetIndexReorderPayload,
  ROOT_PARENT_KEY,
  resolveMoveValidationError,
  type ParentKey,
  type InlineCreatePlacement,
} from '../../src/components/wbs/wbs-tree-utils.js';
import type { WbsItem } from '../../src/types/wbs.js';

function makeWbsItem(overrides: Partial<WbsItem>): WbsItem {
  return {
    id: 0,
    parentId: null,
    name: 'default',
    depth: 0,
    sortOrder: 0,
    assigneeUserId: null,
    assigneeName: null,
    startDate: null,
    endDate: null,
    actualStartDate: null,
    actualEndDate: null,
    progressRate: 0,
    plannedProgressRate: null,
    progressVarianceRate: null,
    startVarianceDays: null,
    endVarianceDays: null,
    estimatedMm: null,
    milestoneId: null,
    milestoneName: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function simplify(placements: InlineCreatePlacement[]) {
  return placements.map((placement) => ({
    afterItemId: placement.afterItemId,
    parentId: placement.parentId,
    depth: placement.depth,
    kind: placement.kind,
  }));
}

test('buildInlineCreatePlacements appends child rows after the last visible descendant of expanded parents', () => {
  const visibleItems: WbsItem[] = [
    makeWbsItem({ id: 1, name: 'Planning', depth: 0 }),
    makeWbsItem({ id: 2, parentId: 1, name: 'Requirements', depth: 1 }),
    makeWbsItem({ id: 3, parentId: 1, name: 'Design', depth: 1 }),
    makeWbsItem({ id: 4, name: 'Implementation', depth: 0 }),
  ];

  const placements = buildInlineCreatePlacements({
    visibleItems,
    hasChildrenById: new Map([
      [1, true],
      [2, false],
      [3, false],
      [4, false],
    ]),
    collapsedIds: new Set<number>(),
  });

  assert.deepEqual(simplify(placements), [
    { afterItemId: 3, parentId: 1, depth: 1, kind: 'child' },
    { afterItemId: 4, parentId: null, depth: 0, kind: 'root' },
  ]);
});

test('buildInlineCreatePlacements hides child rows for collapsed parents', () => {
  const visibleItems: WbsItem[] = [
    makeWbsItem({ id: 10, name: 'Parent', depth: 0 }),
    makeWbsItem({ id: 11, name: 'Sibling', depth: 0 }),
  ];

  const placements = buildInlineCreatePlacements({
    visibleItems,
    hasChildrenById: new Map([
      [10, true],
      [11, false],
    ]),
    collapsedIds: new Set([10]),
  });

  assert.deepEqual(simplify(placements), [
    { afterItemId: 11, parentId: null, depth: 0, kind: 'root' },
  ]);
});

test('buildInlineCreatePlacements still returns the root row for an empty table', () => {
  const placements = buildInlineCreatePlacements({
    visibleItems: [],
    hasChildrenById: new Map<number, boolean>(),
    collapsedIds: new Set<number>(),
  });

  assert.deepEqual(simplify(placements), [
    { afterItemId: null, parentId: null, depth: 0, kind: 'root' },
  ]);
});

test('buildInlineCreatePayload pins the quick-add default fields for Phase 6.1', () => {
  assert.deepEqual(buildInlineCreatePayload('Follow-up spec', 42), {
    name: 'Follow-up spec',
    parentId: 42,
    assigneeUserId: null,
    startDate: null,
    endDate: null,
    actualStartDate: null,
    actualEndDate: null,
    progressRate: 0,
    estimatedMm: null,
    milestoneId: null,
  });
});

test('buildTargetIndexReorderPayload moves an item to a different parent and reorders affected siblings', () => {
  const rootA = makeWbsItem({ id: 1, name: 'A', depth: 0, sortOrder: 0 });
  const rootB = makeWbsItem({ id: 2, name: 'B', depth: 0, sortOrder: 1 });
  const childA1 = makeWbsItem({ id: 3, parentId: 1, name: 'A-1', depth: 1, sortOrder: 0 });
  const childB1 = makeWbsItem({ id: 4, parentId: 2, name: 'B-1', depth: 1, sortOrder: 0 });

  const allItems = [rootA, rootB, childA1, childB1];
  const childrenByParent = new Map<ParentKey, WbsItem[]>([
    [ROOT_PARENT_KEY, [rootA, rootB]],
    [1, [childA1]],
    [2, [childB1]],
  ]);

  const payload = buildTargetIndexReorderPayload({
    allItems,
    childrenByParent,
    activeItemId: 3,
    nextParentId: 2,
    targetIndex: 1,
  });

  assert.deepEqual(payload, {
    items: [{ id: 3, parentId: 2, sortOrder: 1 }],
  });
});

test('buildTargetIndexReorderPayload reorders within the same parent from the top position', () => {
  const root = makeWbsItem({ id: 10, name: 'Root', depth: 0, sortOrder: 0 });
  const childA = makeWbsItem({ id: 11, parentId: 10, name: 'A', depth: 1, sortOrder: 0 });
  const childB = makeWbsItem({ id: 12, parentId: 10, name: 'B', depth: 1, sortOrder: 1 });
  const childC = makeWbsItem({ id: 13, parentId: 10, name: 'C', depth: 1, sortOrder: 2 });

  const payload = buildTargetIndexReorderPayload({
    allItems: [root, childA, childB, childC],
    childrenByParent: new Map<ParentKey, WbsItem[]>([
      [ROOT_PARENT_KEY, [root]],
      [10, [childA, childB, childC]],
    ]),
    activeItemId: 13,
    nextParentId: 10,
    targetIndex: 0,
  });

  assert.deepEqual(payload, {
    items: [
      { id: 13, parentId: 10, sortOrder: 0 },
      { id: 11, parentId: 10, sortOrder: 1 },
      { id: 12, parentId: 10, sortOrder: 2 },
    ],
  });
});

test('resolveMoveValidationError blocks moving an item under its own descendant', () => {
  const root = makeWbsItem({ id: 1, name: 'Root', depth: 0, sortOrder: 0 });
  const child = makeWbsItem({ id: 2, parentId: 1, name: 'Child', depth: 1, sortOrder: 0 });
  const grandchild = makeWbsItem({
    id: 3,
    parentId: 2,
    name: 'Grandchild',
    depth: 2,
    sortOrder: 0,
  });
  const itemById = new Map([root, child, grandchild].map((item) => [item.id, item] as const));

  const error = resolveMoveValidationError({
    activeItemId: 1,
    nextParentId: 3,
    itemById,
    childrenByParent: new Map<ParentKey, WbsItem[]>([
      [ROOT_PARENT_KEY, [root]],
      [1, [child]],
      [2, [grandchild]],
    ]),
  });

  assert.equal(error, 'invalidMove');
});

test('resolveMoveValidationError blocks moves that would push descendants past the max depth', () => {
  const root = makeWbsItem({ id: 1, name: 'Root', depth: 0, sortOrder: 0 });
  const source = makeWbsItem({ id: 2, name: 'Source', depth: 0, sortOrder: 1 });
  const sourceChild = makeWbsItem({
    id: 3,
    parentId: 2,
    name: 'Source child',
    depth: 1,
    sortOrder: 0,
  });
  const deepParent = makeWbsItem({
    id: 4,
    parentId: 1,
    name: 'Deep parent',
    depth: 8,
    sortOrder: 0,
  });
  const items = [root, source, sourceChild, deepParent];
  const itemById = new Map(items.map((item) => [item.id, item] as const));

  const error = resolveMoveValidationError({
    activeItemId: 2,
    nextParentId: 4,
    itemById,
    childrenByParent: new Map<ParentKey, WbsItem[]>([
      [ROOT_PARENT_KEY, [root, source]],
      [1, [deepParent]],
      [2, [sourceChild]],
    ]),
  });

  assert.equal(error, 'depthLimitExceeded');
});
