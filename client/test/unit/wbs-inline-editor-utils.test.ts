import assert from 'node:assert/strict';
import test from 'node:test';
import type { WbsItem } from '../../src/types/wbs.js';
import {
  createWbsInlineDraftState,
  isWbsInlineEditorDirty,
  parseInlineEstimatedMmValue,
  parseInlineProgressValue,
  parseValidatedInlineProgressValue,
  resolveInlineBlurDecision,
} from '../../src/components/wbs/wbs-inline-editor-utils.js';

function createItem(overrides: Partial<WbsItem> = {}): WbsItem {
  return {
    id: 10,
    parentId: null,
    name: '요구사항 분석',
    depth: 0,
    sortOrder: 0,
    assigneeUserId: 7,
    assigneeName: 'Kim',
    startDate: '2026-05-01',
    endDate: '2026-05-03',
    actualStartDate: null,
    actualEndDate: null,
    progressRate: 25,
    plannedProgressRate: null,
    progressVarianceRate: null,
    startVarianceDays: null,
    endVarianceDays: null,
    estimatedMm: 3.5,
    milestoneId: 12,
    milestoneName: 'M1',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

test('createWbsInlineDraftState mirrors the current item fields', () => {
  const item = createItem({ assigneeUserId: null, estimatedMm: null, milestoneId: null });
  const draft = createWbsInlineDraftState(item);

  assert.equal(draft.nameValue, item.name);
  assert.equal(draft.assigneeValue, '__unassigned__');
  assert.equal(draft.startDateValue, item.startDate);
  assert.equal(draft.endDateValue, item.endDate);
  assert.equal(draft.progressValue, '25');
  assert.equal(draft.estimatedMmValue, '');
  assert.equal(draft.milestoneValue, '__none__');
});

test('isWbsInlineEditorDirty detects changed and unchanged drafts per editor', () => {
  const item = createItem();
  const draft = createWbsInlineDraftState(item);

  assert.equal(isWbsInlineEditorDirty('name', item, draft), false);
  draft.nameValue = '요구사항 분석 업데이트';
  assert.equal(isWbsInlineEditorDirty('name', item, draft), true);

  Object.assign(draft, createWbsInlineDraftState(item), { assigneeValue: '__unassigned__' });
  assert.equal(isWbsInlineEditorDirty('assignee', item, draft), true);

  Object.assign(draft, createWbsInlineDraftState(item), { startDateValue: '', endDateValue: '' });
  assert.equal(isWbsInlineEditorDirty('period', item, draft), true);

  Object.assign(draft, createWbsInlineDraftState(item), { progressValue: '25.0' });
  assert.equal(isWbsInlineEditorDirty('progress', item, draft), false);
  draft.progressValue = '';
  assert.equal(isWbsInlineEditorDirty('progress', item, draft), true);

  Object.assign(draft, createWbsInlineDraftState(item), { estimatedMmValue: '3.50' });
  assert.equal(isWbsInlineEditorDirty('estimatedMm', item, draft), false);
  draft.estimatedMmValue = '';
  assert.equal(isWbsInlineEditorDirty('estimatedMm', item, draft), true);

  Object.assign(draft, createWbsInlineDraftState(item), { milestoneValue: '__none__' });
  assert.equal(isWbsInlineEditorDirty('milestone', item, draft), true);
});

test('numeric draft parsers keep blank values invalid for progress and nullable for mm', () => {
  assert(Number.isNaN(parseInlineProgressValue('')));
  assert.equal(parseInlineProgressValue('40'), 40);
  assert.equal(parseValidatedInlineProgressValue('1.5'), 1.5);
  assert.equal(parseValidatedInlineProgressValue('101'), null);
  assert.equal(parseInlineEstimatedMmValue(''), null);
  assert.equal(parseInlineEstimatedMmValue('2.25'), 2.25);
});

test('resolveInlineBlurDecision closes unchanged drafts and confirms dirty ones immediately', () => {
  const item = createItem();
  const draft = createWbsInlineDraftState(item);

  assert.equal(resolveInlineBlurDecision('name', item, draft, () => true), 'unchanged');

  draft.nameValue = '요구사항 분석 업데이트';
  assert.equal(resolveInlineBlurDecision('name', item, draft, () => true), 'save');
  assert.equal(resolveInlineBlurDecision('name', item, draft, () => false), 'discard');
});
