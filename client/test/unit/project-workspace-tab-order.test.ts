import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProjectWorkspaceTabOrder } from '@/lib/project-workspace-tab-order';

test('resolveProjectWorkspaceTabOrder appends missing defaults', () => {
  assert.deepEqual(resolveProjectWorkspaceTabOrder(['documents', 'issues']), [
    'documents',
    'issues',
    'overview',
    'tags',
    'wbs',
    'myTasks',
    'gantt',
    'staffing',
  ]);
});

test('resolveProjectWorkspaceTabOrder drops duplicates and unknown values', () => {
  assert.deepEqual(resolveProjectWorkspaceTabOrder(['documents', 'unknown', 'documents', 'tags']), [
    'documents',
    'tags',
    'overview',
    'wbs',
    'myTasks',
    'gantt',
    'staffing',
    'issues',
  ]);
});

test('resolveProjectWorkspaceTabOrder falls back to default order', () => {
  assert.deepEqual(resolveProjectWorkspaceTabOrder([]), [
    'overview',
    'documents',
    'tags',
    'wbs',
    'myTasks',
    'gantt',
    'staffing',
    'issues',
  ]);
});
