import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWbsHierarchyOptions } from '../../src/components/project/wbs-hierarchy-options.js';
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

test('buildWbsHierarchyOptions exposes full paths for duplicate-name branches', () => {
  const options = buildWbsHierarchyOptions([
    makeWbsItem({ id: 10, name: 'Platform', depth: 0 }),
    makeWbsItem({ id: 11, parentId: 10, name: 'Backend', depth: 1 }),
    makeWbsItem({ id: 12, parentId: 11, name: 'API', depth: 2 }),
    makeWbsItem({ id: 20, name: 'Operations', depth: 0 }),
    makeWbsItem({ id: 21, parentId: 20, name: 'Backend', depth: 1 }),
    makeWbsItem({ id: 22, parentId: 21, name: 'API', depth: 2 }),
  ]);

  assert.deepEqual(
    options.map((option) => ({
      itemId: option.itemId,
      fullPathLabel: option.fullPathLabel,
      ancestorPathLabel: option.ancestorPathLabel,
    })),
    [
      { itemId: 10, fullPathLabel: 'Platform', ancestorPathLabel: null },
      { itemId: 11, fullPathLabel: 'Platform / Backend', ancestorPathLabel: 'Platform' },
      {
        itemId: 12,
        fullPathLabel: 'Platform / Backend / API',
        ancestorPathLabel: 'Platform / Backend',
      },
      { itemId: 20, fullPathLabel: 'Operations', ancestorPathLabel: null },
      { itemId: 21, fullPathLabel: 'Operations / Backend', ancestorPathLabel: 'Operations' },
      {
        itemId: 22,
        fullPathLabel: 'Operations / Backend / API',
        ancestorPathLabel: 'Operations / Backend',
      },
    ],
  );
  assert.equal(options[2]?.searchValue.includes('Platform / Backend / API'), true);
  assert.equal(options[5]?.searchValue.includes('Operations / Backend / API'), true);
});
