import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGanttModel } from '../../src/components/gantt/gantt-adapter.js';
import {
  formatDateOnly,
  inclusiveDurationDays,
  parseDateOnly,
} from '../../src/components/gantt/gantt-date-utils.js';
import {
  applyExpandedTaskState,
  collectExpandableTaskIds,
} from '../../src/components/gantt/gantt-tree-utils.js';
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

function makeDependency(overrides: Partial<WbsDependency>): WbsDependency {
  return {
    id: 0,
    projectId: 1,
    predecessorWbsItemId: 0,
    successorWbsItemId: 0,
    dependencyType: 'FS',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('gantt date utils keep yyyy-MM-dd semantics in local date domain', () => {
  const parsed = parseDateOnly('2026-04-16');

  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 3);
  assert.equal(parsed.getDate(), 16);
  assert.equal(formatDateOnly(parsed), '2026-04-16');

  const duration = inclusiveDurationDays(parseDateOnly('2026-04-14'), parseDateOnly('2026-04-16'));
  assert.equal(duration, 3);
});

test('buildGanttModel maps dated WBS, summary projection, milestones, and stats', () => {
  const wbsItems: WbsItem[] = [
    makeWbsItem({ id: 1, name: 'Planning', depth: 0, sortOrder: 1 }),
    makeWbsItem({
      id: 2,
      parentId: 1,
      name: 'Requirements',
      depth: 1,
      sortOrder: 1,
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      progressRate: 40,
    }),
    makeWbsItem({
      id: 3,
      parentId: 1,
      name: 'No Schedule Leaf',
      depth: 1,
      sortOrder: 2,
    }),
    makeWbsItem({
      id: 4,
      name: 'Implementation',
      depth: 0,
      sortOrder: 2,
      startDate: '2026-04-10',
      endDate: '2026-05-01',
      progressRate: 15,
    }),
  ];

  const milestones: Milestone[] = [
    makeMilestone({
      id: 21,
      sortOrder: 2,
      name: 'Alpha Cut',
      targetDate: '2026-04-01',
      linkedWbsItemCount: 2,
      isDelayed: false,
    }),
    makeMilestone({
      id: 20,
      sortOrder: 1,
      name: 'Kickoff',
      targetDate: '2026-02-20',
      linkedWbsItemCount: 1,
      isDelayed: true,
    }),
  ];

  const model = buildGanttModel({ wbsItems, milestones, dependencies: [] });
  const taskById = new Map(model.tasks.map((task) => [String(task.id), task]));

  const planning = taskById.get('1');
  const requirements = taskById.get('2');
  const implementation = taskById.get('4');
  const kickoff = taskById.get('milestone:20');
  const alphaCut = taskById.get('milestone:21');

  assert.ok(planning);
  assert.equal(planning?.type, 'summary');
  assert.equal(planning?.text, 'Planning');

  assert.ok(requirements);
  assert.equal(requirements?.type, 'task');
  assert.equal(requirements?.parent, 1);
  assert.equal(requirements?.text, 'Requirements');
  assert.equal(requirements?.progress, 40);

  assert.ok(implementation);
  assert.equal(implementation?.type, 'task');
  assert.equal(implementation?.text, 'Implementation');

  assert.equal(taskById.has('3'), false);

  assert.ok(kickoff);
  assert.equal(kickoff?.type, 'milestone');
  assert.equal(kickoff?.text, 'Kickoff');
  assert.equal(kickoff?.isDelayed, true);
  assert.equal(kickoff?.critical, true);

  assert.ok(alphaCut);
  assert.equal(alphaCut?.type, 'milestone');
  assert.equal(alphaCut?.text, 'Alpha Cut');
  assert.equal(alphaCut?.linkedWbsItemCount, 2);
  assert.equal(alphaCut?.critical, false);

  assert.equal(model.stats.omittedItemCount, 1);
  assert.equal(model.stats.datedTaskCount, 2);
  assert.equal(model.stats.milestoneCount, 2);

  assert.equal(formatDateOnly(model.range.start), '2026-02-13');
  assert.equal(formatDateOnly(model.range.end), '2026-05-08');
});

test('buildGanttModel preserves WBS sort order before milestone append', () => {
  const wbsItems: WbsItem[] = [
    makeWbsItem({ id: 1, name: 'Root', depth: 0, sortOrder: 1 }),
    makeWbsItem({
      id: 2,
      parentId: 1,
      name: 'Child A',
      depth: 1,
      sortOrder: 2,
      startDate: '2026-03-11',
      endDate: '2026-03-12',
    }),
    makeWbsItem({
      id: 5,
      parentId: 1,
      name: 'Child B',
      depth: 1,
      sortOrder: 3,
      startDate: '2026-03-13',
      endDate: '2026-03-14',
    }),
    makeWbsItem({
      id: 4,
      name: 'Second Root',
      depth: 0,
      sortOrder: 2,
      startDate: '2026-03-15',
      endDate: '2026-03-18',
    }),
  ];

  const milestones: Milestone[] = [
    makeMilestone({ id: 50, sortOrder: 2, targetDate: '2026-03-10' }),
    makeMilestone({ id: 49, sortOrder: 1, targetDate: '2026-03-09' }),
  ];

  const model = buildGanttModel({ wbsItems, milestones, dependencies: [] });
  const wbsOrder = model.tasks
    .filter((task) => task.kind !== 'milestone')
    .map((task) => Number(task.id));
  const milestoneOrder = model.tasks
    .filter((task) => task.kind === 'milestone')
    .map((task) => String(task.id));

  assert.deepEqual(wbsOrder, [1, 2, 5, 4]);
  assert.deepEqual(milestoneOrder, ['milestone:49', 'milestone:50']);
});

test('buildGanttModel derives rolling-wave summary from next incomplete milestone', () => {
  const wbsItems: WbsItem[] = [
    makeWbsItem({
      id: 1,
      name: 'Prep release note',
      depth: 0,
      sortOrder: 1,
      milestoneId: 20,
      progressRate: 100,
      startDate: '2026-03-01',
      endDate: '2026-03-02',
    }),
    makeWbsItem({
      id: 2,
      name: 'Approval checklist',
      depth: 0,
      sortOrder: 2,
      milestoneId: 21,
      progressRate: 50,
      startDate: '2026-03-03',
      endDate: '2026-03-05',
    }),
    makeWbsItem({
      id: 3,
      name: 'Post-launch follow-up',
      depth: 0,
      sortOrder: 3,
      milestoneId: 22,
      progressRate: 0,
      startDate: '2026-03-10',
      endDate: '2026-03-12',
    }),
    makeWbsItem({
      id: 4,
      name: 'Future candidate without gate',
      depth: 0,
      sortOrder: 4,
      progressRate: 25,
      startDate: '2026-03-15',
      endDate: '2026-03-18',
    }),
  ];

  const milestones: Milestone[] = [
    makeMilestone({
      id: 20,
      sortOrder: 1,
      name: 'Release prep',
      targetDate: '2026-03-02',
      linkedWbsItemCount: 1,
      achievementRate: 100,
    }),
    makeMilestone({
      id: 21,
      sortOrder: 2,
      name: 'Gate approval',
      targetDate: '2026-03-06',
      linkedWbsItemCount: 1,
      achievementRate: 50,
    }),
    makeMilestone({
      id: 22,
      sortOrder: 3,
      name: 'Launch follow-up',
      targetDate: '2026-03-12',
      linkedWbsItemCount: 1,
      achievementRate: 0,
    }),
  ];

  const model = buildGanttModel({ wbsItems, milestones, dependencies: [] });

  assert.deepEqual(model.waveSummary.focusMilestone, {
    id: 21,
    name: 'Gate approval',
    targetDate: '2026-03-06',
    linkedWbsItemCount: 1,
    achievementRate: 50,
    isDelayed: false,
  });
  assert.equal(model.waveSummary.currentWaveTaskCount, 1);
  assert.equal(model.waveSummary.currentWaveCompletedTaskCount, 0);
  assert.equal(model.waveSummary.futureMilestoneCount, 1);
  assert.equal(model.waveSummary.futureTaskCount, 1);
  assert.equal(model.waveSummary.unplannedTaskCount, 1);
});

test('buildGanttModel emits dependency and milestone flow links with connectivity meta', () => {
  const wbsItems: WbsItem[] = [
    makeWbsItem({
      id: 1,
      name: 'Design',
      depth: 0,
      sortOrder: 1,
      startDate: '2026-03-01',
      endDate: '2026-03-03',
      milestoneId: 41,
    }),
    makeWbsItem({
      id: 2,
      name: 'Build',
      depth: 0,
      sortOrder: 2,
      startDate: '2026-03-04',
      endDate: '2026-03-08',
    }),
    makeWbsItem({
      id: 3,
      name: 'QA',
      depth: 0,
      sortOrder: 3,
      startDate: '2026-03-09',
      endDate: '2026-03-11',
    }),
  ];
  const milestones: Milestone[] = [
    makeMilestone({
      id: 41,
      name: 'Release gate',
      sortOrder: 1,
      targetDate: '2026-03-12',
      linkedWbsItemCount: 1,
    }),
  ];
  const dependencies: WbsDependency[] = [
    makeDependency({
      id: 100,
      predecessorWbsItemId: 1,
      successorWbsItemId: 2,
      dependencyType: 'FS',
    }),
    makeDependency({
      id: 101,
      predecessorWbsItemId: 2,
      successorWbsItemId: 3,
      dependencyType: 'SS',
    }),
  ];

  const model = buildGanttModel({ wbsItems, milestones, dependencies });
  const linkById = new Map(model.links.map((link) => [link.id, link]));
  const taskMetaById = model.taskMetaById;

  assert.equal(model.stats.dependencyCount, 2);
  assert.equal(model.stats.dependencyTaskCount, 3);
  assert.equal(model.stats.milestoneFlowCount, 1);

  assert.equal(linkById.get('dependency:100')?.type, 'e2s');
  assert.equal(linkById.get('dependency:100')?.kind, 'dependency');
  assert.equal(linkById.get('dependency:101')?.type, 's2s');
  assert.equal(linkById.get('milestone-flow:1:41')?.kind, 'milestone');

  assert.deepEqual(taskMetaById.get('1')?.successorTaskIds, ['2']);
  assert.equal(taskMetaById.get('1')?.milestoneTaskId, 'milestone:41');
  assert.deepEqual(taskMetaById.get('2')?.predecessorTaskIds, ['1']);
  assert.deepEqual(taskMetaById.get('2')?.successorTaskIds, ['3']);
  assert.deepEqual(taskMetaById.get('3')?.predecessorTaskIds, ['2']);
  const milestoneMeta = taskMetaById.get('milestone:41');
  assert.equal(milestoneMeta?.kind, 'milestone');
  if (milestoneMeta?.kind !== 'milestone') {
    throw new Error('expected milestone metadata');
  }
  assert.equal(milestoneMeta.inboundMilestoneFlowCount, 1);
});

test('collectExpandableTaskIds returns only non-milestone branches with children', () => {
  const wbsItems: WbsItem[] = [
    makeWbsItem({ id: 1, name: 'Root', depth: 0, sortOrder: 1 }),
    makeWbsItem({
      id: 2,
      parentId: 1,
      name: 'Child A',
      depth: 1,
      sortOrder: 1,
      startDate: '2026-03-11',
      endDate: '2026-03-12',
    }),
    makeWbsItem({
      id: 3,
      parentId: 2,
      name: 'Grandchild',
      depth: 2,
      sortOrder: 1,
      startDate: '2026-03-13',
      endDate: '2026-03-14',
    }),
    makeWbsItem({
      id: 4,
      name: 'Standalone',
      depth: 0,
      sortOrder: 2,
      startDate: '2026-03-15',
      endDate: '2026-03-18',
    }),
  ];

  const milestones: Milestone[] = [makeMilestone({ id: 50, targetDate: '2026-03-10' })];
  const model = buildGanttModel({ wbsItems, milestones, dependencies: [] });

  assert.deepEqual(collectExpandableTaskIds(model.tasks), [1, 2]);
});

test('applyExpandedTaskState applies open flags only to expandable branches', () => {
  const wbsItems: WbsItem[] = [
    makeWbsItem({ id: 1, name: 'Root', depth: 0, sortOrder: 1 }),
    makeWbsItem({
      id: 2,
      parentId: 1,
      name: 'Child A',
      depth: 1,
      sortOrder: 1,
      startDate: '2026-03-11',
      endDate: '2026-03-12',
    }),
    makeWbsItem({
      id: 3,
      parentId: 2,
      name: 'Grandchild',
      depth: 2,
      sortOrder: 1,
      startDate: '2026-03-13',
      endDate: '2026-03-14',
    }),
    makeWbsItem({
      id: 4,
      name: 'Standalone',
      depth: 0,
      sortOrder: 2,
      startDate: '2026-03-15',
      endDate: '2026-03-18',
    }),
  ];

  const model = buildGanttModel({
    wbsItems,
    milestones: [makeMilestone({ id: 50 })],
    dependencies: [],
  });
  const tasks = applyExpandedTaskState(model.tasks, new Set(['1']));
  const taskById = new Map(tasks.map((task) => [String(task.id), task]));

  assert.equal(taskById.get('1')?.open, true);
  assert.equal(taskById.get('2')?.open, false);
  assert.equal(taskById.get('3')?.open, undefined);
  assert.equal(taskById.get('4')?.open, undefined);
  assert.equal(taskById.get('milestone:50')?.open, undefined);
});
