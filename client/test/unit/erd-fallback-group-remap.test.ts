import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildFallbackGroupAssignments } from '../../src/lib/erd-fallback-group-remap.js';
import type { TableDiff } from '../../src/lib/erd-diff-plan.js';

test('buildFallbackGroupAssignments 는 high-confidence update 테이블만 재매핑한다', () => {
  const groups = [
    { id: 'group-1', tableIds: ['table-1', 'table-2', 'table-3'] },
    { id: 'group-2', tableIds: ['table-3'] },
  ];

  const tableDiffs: TableDiff[] = [
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-1',
      current: {
        id: 'table-1',
        name: 'users',
        position: { x: 0, y: 0 },
        columns: [],
      },
      next: {
        name: 'members',
        columns: [],
      },
      match: {
        strategy: 'rename-promoted',
        confidence: 'high',
        candidateCount: 1,
      },
      rename: {
        from: 'users',
        to: 'members',
      },
    },
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-2',
      current: {
        id: 'table-2',
        name: 'logs',
        position: { x: 0, y: 0 },
        columns: [],
      },
      next: {
        name: 'audit_logs',
        columns: [],
      },
      match: {
        strategy: 'delete-add',
        confidence: 'medium',
        candidateCount: 2,
        renameRejectReason: 'non-unique-candidate',
      },
    },
    {
      entity: 'table',
      op: 'delete',
      tableId: 'table-3',
      current: {
        id: 'table-3',
        name: 'temp',
        position: { x: 0, y: 0 },
        columns: [],
      },
      reason: 'delete-add-safety',
    },
  ];

  const nextNodes = [
    { id: 'table-n1', data: { label: 'members' } },
    { id: 'table-n2', data: { label: 'audit_logs' } },
  ];

  const assignments = buildFallbackGroupAssignments(groups, tableDiffs, nextNodes);
  assert.equal(assignments.length, 2);
  assert.deepEqual(assignments[0], {
    groupId: 'group-1',
    tableIds: ['table-n1'],
    droppedCount: 2,
  });
  assert.deepEqual(assignments[1], {
    groupId: 'group-2',
    tableIds: [],
    droppedCount: 1,
  });
});

test('buildFallbackGroupAssignments 는 동일 라벨 노드가 여러 개여도 이전 테이블별로 분배한다', () => {
  const groups = [{ id: 'group-1', tableIds: ['table-1', 'table-2'] }];

  const tableDiffs: TableDiff[] = [
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-1',
      current: { id: 'table-1', name: 'users_a', position: { x: 0, y: 0 }, columns: [] },
      next: { name: 'members', columns: [] },
      match: { strategy: 'rename-promoted', confidence: 'high', candidateCount: 1 },
      rename: { from: 'users_a', to: 'members' },
    },
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-2',
      current: { id: 'table-2', name: 'users_b', position: { x: 0, y: 0 }, columns: [] },
      next: { name: 'members', columns: [] },
      match: { strategy: 'rename-promoted', confidence: 'high', candidateCount: 1 },
      rename: { from: 'users_b', to: 'members' },
    },
  ];

  const nextNodes = [
    { id: 'table-n1', data: { label: 'members' } },
    { id: 'table-n2', data: { label: 'members' } },
  ];

  const assignments = buildFallbackGroupAssignments(groups, tableDiffs, nextNodes);
  assert.equal(assignments.length, 1);
  assert.deepEqual(assignments[0], {
    groupId: 'group-1',
    tableIds: ['table-n1', 'table-n2'],
    droppedCount: 0,
  });
});
