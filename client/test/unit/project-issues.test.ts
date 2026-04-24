import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProjectIssueQueryParams,
  getProjectIssueEditableStatuses,
  getNextProjectIssueStatus,
  getProjectIssueTransitionLabelKey,
  normalizeProjectIssueFilters,
  PROJECT_ISSUE_FILTER_ALL,
  PROJECT_ISSUE_FILTER_UNASSIGNED,
} from '../../src/lib/project-issues.js';

test('normalizeProjectIssueFilters returns an empty filter object when all selectors are reset', () => {
  const filters = normalizeProjectIssueFilters({
    status: PROJECT_ISSUE_FILTER_ALL,
    priority: PROJECT_ISSUE_FILTER_ALL,
    assignee: PROJECT_ISSUE_FILTER_ALL,
  });

  assert.deepEqual(filters, {});
});

test('normalizeProjectIssueFilters maps explicit status, priority, and assignee selections', () => {
  const filters = normalizeProjectIssueFilters({
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignee: '42',
  });

  assert.deepEqual(filters, {
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assigneeUserId: 42,
  });
});

test('normalizeProjectIssueFilters maps the unassigned sentinel to unassignedOnly', () => {
  const filters = normalizeProjectIssueFilters({
    status: PROJECT_ISSUE_FILTER_ALL,
    priority: PROJECT_ISSUE_FILTER_ALL,
    assignee: PROJECT_ISSUE_FILTER_UNASSIGNED,
  });

  assert.deepEqual(filters, {
    unassignedOnly: true,
  });
});

test('buildProjectIssueQueryParams serializes the normalized filters for API requests', () => {
  const params = buildProjectIssueQueryParams({
    status: 'REGISTERED',
    priority: 'CRITICAL',
    assigneeUserId: 9,
  });

  assert.deepEqual(params, {
    status: 'REGISTERED',
    priority: 'CRITICAL',
    assigneeUserId: 9,
  });
});

test('getNextProjectIssueStatus advances in the approved v1 sequence only', () => {
  assert.equal(getNextProjectIssueStatus('REGISTERED'), 'IN_PROGRESS');
  assert.equal(getNextProjectIssueStatus('IN_PROGRESS'), 'DONE');
  assert.equal(getNextProjectIssueStatus('DONE'), null);
});

test('getProjectIssueTransitionLabelKey returns null once an issue is already done', () => {
  assert.equal(getProjectIssueTransitionLabelKey('REGISTERED'), 'issues.action.start');
  assert.equal(getProjectIssueTransitionLabelKey('IN_PROGRESS'), 'issues.action.markDone');
  assert.equal(getProjectIssueTransitionLabelKey('DONE'), null);
});

test('getProjectIssueEditableStatuses keeps edit mode forward-only', () => {
  assert.deepEqual(getProjectIssueEditableStatuses('REGISTERED'), [
    'REGISTERED',
    'IN_PROGRESS',
    'DONE',
  ]);
  assert.deepEqual(getProjectIssueEditableStatuses('IN_PROGRESS'), ['IN_PROGRESS', 'DONE']);
  assert.deepEqual(getProjectIssueEditableStatuses('DONE'), ['DONE']);
});
