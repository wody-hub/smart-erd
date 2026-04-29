import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWbsDependencySummary } from '../../src/components/wbs/wbs-dependency-summary.js';
import type { Milestone } from '../../src/types/milestone.js';
import type { WbsDependency } from '../../src/types/wbs-dependency.js';
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

function makeDependency(overrides: Partial<WbsDependency>): WbsDependency {
  return {
    id: 0,
    projectId: 1,
    predecessorWbsItemId: 0,
    predecessorWbsItemName: null,
    successorWbsItemId: 0,
    successorWbsItemName: null,
    dependencyType: 'FS',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMilestone(overrides: Partial<Milestone>): Milestone {
  return {
    id: 0,
    projectId: 1,
    name: 'milestone',
    targetDate: '2026-01-01',
    description: null,
    type: 'DELIVERABLE',
    ownerUserId: null,
    ownerName: null,
    readinessNote: null,
    sortOrder: 0,
    linkedWbsItemCount: 0,
    linkedWbsCompletedCount: 0,
    achievementRate: 0,
    inboundDependencyCount: 0,
    outboundDependencyCount: 0,
    nextWaveWbsCount: 0,
    isDelayed: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('buildWbsDependencySummary resolves the earliest reachable milestone chain', () => {
  const allItems: WbsItem[] = [
    makeWbsItem({ id: 10, name: 'Design API' }),
    makeWbsItem({ id: 11, name: 'Build UI' }),
    makeWbsItem({ id: 12, name: 'QA Signoff', milestoneId: 7 }),
    makeWbsItem({ id: 13, name: 'Later Rollout', milestoneId: 8 }),
  ];
  const dependencies: WbsDependency[] = [
    makeDependency({ id: 1, predecessorWbsItemId: 9, successorWbsItemId: 10 }),
    makeDependency({ id: 2, predecessorWbsItemId: 10, successorWbsItemId: 11 }),
    makeDependency({ id: 3, predecessorWbsItemId: 11, successorWbsItemId: 12 }),
    makeDependency({ id: 4, predecessorWbsItemId: 10, successorWbsItemId: 13 }),
  ];
  const milestones: Milestone[] = [
    makeMilestone({ id: 7, name: 'Alpha', targetDate: '2026-05-01', sortOrder: 1 }),
    makeMilestone({ id: 8, name: 'GA', targetDate: '2026-06-01', sortOrder: 2 }),
  ];

  const summary = buildWbsDependencySummary({
    item: allItems[0],
    allItems,
    dependencies,
    milestones,
  });

  assert.equal(summary.predecessorCount, 1);
  assert.equal(summary.successorCount, 2);
  assert.equal(summary.nextMilestone?.id, 7);
  assert.equal(summary.isInCurrentWave, true);
  assert.deepEqual(
    summary.blockingChain.map((entry) => entry.id),
    [10, 11, 12],
  );
});

test('buildWbsDependencySummary returns empty chain when no reachable milestone exists', () => {
  const allItems: WbsItem[] = [
    makeWbsItem({ id: 20, name: 'Backlog item' }),
    makeWbsItem({ id: 21, name: 'Follow-up' }),
  ];
  const dependencies: WbsDependency[] = [
    makeDependency({ id: 10, predecessorWbsItemId: 20, successorWbsItemId: 21 }),
  ];

  const summary = buildWbsDependencySummary({
    item: allItems[0],
    allItems,
    dependencies,
    milestones: [],
  });

  assert.equal(summary.nextMilestone, null);
  assert.equal(summary.isInCurrentWave, false);
  assert.deepEqual(summary.blockingChain, []);
});
