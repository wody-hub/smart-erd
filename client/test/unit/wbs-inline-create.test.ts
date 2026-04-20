import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInlineCreatePayload,
  buildInlineCreatePlacements,
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
    progressRate: 0,
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
    progressRate: 0,
    estimatedMm: null,
    milestoneId: null,
  });
});
