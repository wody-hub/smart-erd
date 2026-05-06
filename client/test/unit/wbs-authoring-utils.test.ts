import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDependencyShiftPreview,
  parseBulkCreateOutline,
} from '../../src/components/wbs/wbs-authoring-utils.js';
import type { WbsItem } from '../../src/types/wbs.js';
import type { WbsDependency } from '../../src/types/wbs-dependency.js';

function makeItem(overrides: Partial<WbsItem>): WbsItem {
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
    createdAt: '2026-05-06T00:00:00Z',
    updatedAt: '2026-05-06T00:00:00Z',
    ...overrides,
  };
}

test('parseBulkCreateOutline parses bullets and nested indentation', () => {
  const result = parseBulkCreateOutline(`- Discovery\n  - Workshop\n  - Review\n- Delivery`);

  assert.deepEqual(
    result.items.map((entry) => ({
      lineNumber: entry.lineNumber,
      name: entry.name,
      depth: entry.depth,
    })),
    [
      { lineNumber: 1, name: 'Discovery', depth: 0 },
      { lineNumber: 2, name: 'Workshop', depth: 1 },
      { lineNumber: 3, name: 'Review', depth: 1 },
      { lineNumber: 4, name: 'Delivery', depth: 0 },
    ],
  );
  assert.equal(result.errors.length, 0);
});

test('parseBulkCreateOutline reports line-level indent jumps', () => {
  const result = parseBulkCreateOutline(`- Root\n      - Too deep`);

  assert.deepEqual(result.errors, [{ lineNumber: 2, messageKey: 'indentJump' }]);
});

test('buildDependencyShiftPreview shifts anchor and reachable successors only', () => {
  const items = [
    makeItem({ id: 1, name: 'Design', startDate: '2026-05-01', endDate: '2026-05-03' }),
    makeItem({
      id: 2,
      name: 'Build',
      startDate: '2026-05-04',
      endDate: '2026-05-08',
    }),
    makeItem({
      id: 3,
      name: 'QA',
      startDate: '2026-05-09',
      endDate: '2026-05-10',
    }),
    makeItem({ id: 4, name: 'Parallel', startDate: '2026-05-02', endDate: '2026-05-05' }),
  ];
  const dependencies: WbsDependency[] = [
    {
      id: 100,
      projectId: 77,
      predecessorWbsItemId: 1,
      predecessorWbsItemName: 'Design',
      successorWbsItemId: 2,
      successorWbsItemName: 'Build',
      dependencyType: 'FS',
      sortOrder: 0,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    },
    {
      id: 101,
      projectId: 77,
      predecessorWbsItemId: 2,
      predecessorWbsItemName: 'Build',
      successorWbsItemId: 3,
      successorWbsItemName: 'QA',
      dependencyType: 'FS',
      sortOrder: 1,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    },
  ];

  const preview = buildDependencyShiftPreview({
    anchorItemId: 1,
    allItems: items,
    dependencies,
    shiftDays: 2,
  });

  assert.deepEqual(
    preview.map((entry) => ({
      id: entry.item.id,
      startDate: entry.nextStartDate,
      endDate: entry.nextEndDate,
      reason: entry.reason,
    })),
    [
      { id: 1, startDate: '2026-05-03', endDate: '2026-05-05', reason: 'anchor' },
      { id: 2, startDate: '2026-05-06', endDate: '2026-05-10', reason: 'downstream' },
      { id: 3, startDate: '2026-05-11', endDate: '2026-05-12', reason: 'downstream' },
    ],
  );
});
