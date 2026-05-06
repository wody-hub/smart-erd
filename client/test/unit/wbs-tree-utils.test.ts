import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_WBS_DEPTH,
  buildChildrenByParent,
  buildInlineCreatePayload,
  buildInlineCreatePlacements,
  collectDescendantIds,
  planStructuralMove,
  resolveMoveValidationError,
} from '../../src/components/wbs/wbs-tree-utils.js';

function createItem(overrides: Partial<Record<string, unknown>> = {}) {
  const now = '2026-05-06T00:00:00.000Z';
  return {
    id: 1,
    parentId: null,
    name: 'Item',
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test.describe('wbs-tree-utils', () => {
  test('collectDescendantIds returns the full nested subtree only', () => {
    const items = [
      createItem({ id: 1, name: 'Root' }),
      createItem({ id: 2, parentId: 1, depth: 1, name: 'Child A' }),
      createItem({ id: 3, parentId: 2, depth: 2, name: 'Grandchild' }),
      createItem({ id: 4, parentId: 1, depth: 1, name: 'Child B' }),
      createItem({ id: 5, name: 'Other Root', sortOrder: 1 }),
    ];

    assert.deepEqual(
      [...collectDescendantIds(2, items)].sort((left, right) => left - right),
      [3],
    );
    assert.deepEqual(
      [...collectDescendantIds(1, items)].sort((left, right) => left - right),
      [2, 3, 4],
    );
  });

  test('resolveMoveValidationError rejects moving an item under its own descendant', () => {
    const items = [
      createItem({ id: 10, name: 'Platform' }),
      createItem({ id: 11, parentId: 10, depth: 1, name: 'Frontend' }),
      createItem({ id: 12, parentId: 11, depth: 2, name: 'WBS UX' }),
    ];
    const itemById = new Map(items.map((item) => [item.id, item]));

    assert.equal(
      resolveMoveValidationError({
        activeItemId: 10,
        nextParentId: 12,
        itemById,
        childrenByParent: buildChildrenByParent(items),
      }),
      'invalidMove',
    );
  });

  test('resolveMoveValidationError enforces the maximum depth limit', () => {
    const items = [
      createItem({ id: 20, name: 'Active Root' }),
      createItem({ id: 21, parentId: 20, depth: 1, name: 'Nested Child' }),
      createItem({ id: 99, depth: MAX_WBS_DEPTH, name: 'Too Deep Parent', sortOrder: 1 }),
    ];
    const itemById = new Map(items.map((item) => [item.id, item]));

    assert.equal(
      resolveMoveValidationError({
        activeItemId: 20,
        nextParentId: 99,
        itemById,
        childrenByParent: buildChildrenByParent(items),
      }),
      'depthLimitExceeded',
    );
  });

  test('buildInlineCreatePlacements adds child rows after the last visible descendant and a root row at the end', () => {
    const visibleItems = [
      createItem({ id: 1, name: 'Root A' }),
      createItem({ id: 2, parentId: 1, depth: 1, name: 'Child A-1' }),
      createItem({ id: 3, name: 'Root B', sortOrder: 1 }),
    ];

    assert.deepEqual(
      buildInlineCreatePlacements({
        visibleItems,
        hasChildrenById: new Map([
          [1, true],
          [2, false],
          [3, true],
        ]),
        collapsedIds: new Set([3]),
      }),
      [
        { afterItemId: 2, parentId: 1, depth: 1, kind: 'child' },
        { afterItemId: 3, parentId: null, depth: 0, kind: 'root' },
      ],
    );
  });

  test('buildInlineCreatePayload keeps authoring defaults explicit', () => {
    assert.deepEqual(buildInlineCreatePayload('New WBS', 7), {
      name: 'New WBS',
      parentId: 7,
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

  test('planStructuralMove returns same-parent moves for up/down actions', () => {
    const items = [
      createItem({ id: 1, name: 'Root' }),
      createItem({ id: 2, parentId: 1, depth: 1, name: 'A' }),
      createItem({ id: 3, parentId: 1, depth: 1, name: 'B', sortOrder: 1 }),
      createItem({ id: 4, parentId: 1, depth: 1, name: 'C', sortOrder: 2 }),
    ];
    const itemById = new Map(items.map((item) => [item.id, item]));
    const childrenByParent = buildChildrenByParent(items);

    assert.deepEqual(
      planStructuralMove({
        action: 'moveUp',
        activeItemId: 3,
        allItems: items,
        childrenByParent,
        itemById,
      }),
      { nextParentId: 1, targetIndex: 0 },
    );
    assert.deepEqual(
      planStructuralMove({
        action: 'moveDown',
        activeItemId: 3,
        allItems: items,
        childrenByParent,
        itemById,
      }),
      { nextParentId: 1, targetIndex: 2 },
    );
  });

  test('planStructuralMove derives indent/outdent targets without a modal', () => {
    const items = [
      createItem({ id: 10, name: 'Root' }),
      createItem({ id: 11, parentId: 10, depth: 1, name: 'Discovery' }),
      createItem({ id: 12, parentId: 10, depth: 1, name: 'Delivery', sortOrder: 1 }),
      createItem({ id: 13, parentId: 12, depth: 2, name: 'Build', sortOrder: 0 }),
    ];
    const itemById = new Map(items.map((item) => [item.id, item]));
    const childrenByParent = buildChildrenByParent(items);

    assert.deepEqual(
      planStructuralMove({
        action: 'indent',
        activeItemId: 12,
        allItems: items,
        childrenByParent,
        itemById,
      }),
      { nextParentId: 11, targetIndex: 0 },
    );
    assert.deepEqual(
      planStructuralMove({
        action: 'outdent',
        activeItemId: 13,
        allItems: items,
        childrenByParent,
        itemById,
      }),
      { nextParentId: 10, targetIndex: 2 },
    );
  });
});
