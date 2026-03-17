import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDiffPlanSummary,
  createCurrentSnapshots,
  hasDiffChanges,
} from '../../src/lib/erd-diff-plan.js';
import type {
  ColumnDiff,
  DiffSourceEdge,
  EdgeDiff,
  TableDiff,
} from '../../src/lib/erd-diff-plan.js';

test('buildDiffPlanSummary 는 table/column/edge 연산 수를 정확히 집계한다', () => {
  const tables: TableDiff[] = [
    {
      entity: 'table',
      op: 'add',
      next: {
        name: 'users',
        columns: [],
      },
    },
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-1',
      current: {
        id: 'table-1',
        name: 'users',
        position: { x: 100, y: 120 },
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
      op: 'delete',
      tableId: 'table-2',
      current: {
        id: 'table-2',
        name: 'legacy_users',
        position: { x: 200, y: 120 },
        columns: [],
      },
      reason: 'missing-in-next',
    },
  ];

  const columns: ColumnDiff[] = [
    {
      entity: 'column',
      op: 'add',
      tableId: 'table-1',
      next: {
        name: 'email',
        type: 'VARCHAR(120)',
        pk: false,
        nullable: false,
        autoIncrement: false,
      },
      nextIndex: 2,
    },
    {
      entity: 'column',
      op: 'update',
      tableId: 'table-1',
      columnId: 'col-1-1',
      current: {
        id: 'col-1-1',
        name: 'name',
        type: 'VARCHAR(60)',
      },
      next: {
        name: 'name',
        type: 'VARCHAR(120)',
        pk: false,
        nullable: false,
        autoIncrement: false,
      },
    },
    {
      entity: 'column',
      op: 'delete',
      tableId: 'table-1',
      columnId: 'col-1-9',
      current: {
        id: 'col-1-9',
        name: 'legacy_code',
        type: 'VARCHAR(20)',
      },
    },
  ];

  const edges: EdgeDiff[] = [
    {
      entity: 'edge',
      op: 'add',
      next: {
        parentTable: 'teams',
        parentColumn: 'id',
        childTable: 'users',
        childColumn: 'team_id',
      },
      relationType: 'non-identifying',
    },
    {
      entity: 'edge',
      op: 'update',
      edgeId: 'e-1',
      current: {
        id: 'e-1',
        source: 'table-2',
        target: 'table-1',
        sourceHandle: 'table-2-col-1-source',
        targetHandle: 'table-1-col-2-target',
        relationType: 'non-identifying',
      },
      nextRelationType: 'identifying',
    },
    {
      entity: 'edge',
      op: 'delete',
      edgeId: 'e-legacy',
      current: {
        id: 'e-legacy',
        source: 'table-9',
        target: 'table-8',
        relationType: 'non-identifying',
      },
    },
  ];

  const summary = buildDiffPlanSummary({ tables, columns, edges });

  assert.equal(summary.tableAdds, 1);
  assert.equal(summary.tableUpdates, 1);
  assert.equal(summary.tableDeletes, 1);
  assert.equal(summary.columnAdds, 1);
  assert.equal(summary.columnUpdates, 1);
  assert.equal(summary.columnDeletes, 1);
  assert.equal(summary.edgeAdds, 1);
  assert.equal(summary.edgeUpdates, 1);
  assert.equal(summary.edgeDeletes, 1);
  assert.equal(summary.totalOperations, 9);
});

test('hasDiffChanges 는 변경 연산이 없으면 false 를 반환한다', () => {
  const changed = hasDiffChanges({
    tables: [],
    columns: [],
    edges: [],
  });
  assert.equal(changed, false);
});

test('createCurrentSnapshots 는 노드/엣지를 비교용 스냅샷으로 변환한다', () => {
  const nodes = [
    {
      id: 'table-1',
      type: 'table',
      position: { x: 10, y: 20 },
      data: {
        label: 'users',
        logicalTableName: '사용자',
        columns: [
          {
            id: 'col-1',
            name: 'id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
            autoIncrement: true,
          },
        ],
      },
    },
  ];

  const edges: DiffSourceEdge[] = [
    {
      id: 'edge-1',
      source: 'table-2',
      target: 'table-1',
      sourceHandle: 'table-2-col-1-source',
      targetHandle: 'table-1-col-1-target',
      data: {
        relationType: 'identifying',
      },
    },
  ];

  const snapshots = createCurrentSnapshots(nodes, edges);
  assert.equal(snapshots.tables.length, 1);
  assert.equal(snapshots.tables[0]?.name, 'users');
  assert.equal(snapshots.tables[0]?.columns.length, 1);
  assert.equal(snapshots.edgeById['edge-1']?.relationType, 'identifying');
});
