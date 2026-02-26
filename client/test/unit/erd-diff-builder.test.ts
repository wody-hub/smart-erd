import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildErdTableDiffPlan } from '../../src/lib/erd-diff-builder.js';
import type {
  CurrentEdgeSnapshot,
  CurrentTableSnapshot,
  DiffParsedRelation,
  DiffParsedTable,
} from '../../src/lib/erd-diff-plan.js';

function createCurrentTable(
  id: string,
  name: string,
  columnNames: string[],
  pkName = 'id',
): CurrentTableSnapshot {
  return {
    id,
    name,
    position: { x: 0, y: 0 },
    columns: columnNames.map((columnName, index) => ({
      id: `col-${id}-${index + 1}`,
      name: columnName,
      type: columnName === pkName ? 'BIGINT' : 'VARCHAR(120)',
      pk: columnName === pkName,
      nullable: columnName !== pkName,
      autoIncrement: columnName === pkName,
    })),
  };
}

function createParsedTable(name: string, columnNames: string[], pkName = 'id'): DiffParsedTable {
  return {
    name,
    columns: columnNames.map((columnName) => ({
      name: columnName,
      type: columnName === pkName ? 'BIGINT' : 'VARCHAR(120)',
      pk: columnName === pkName,
      nullable: columnName !== pkName,
      autoIncrement: columnName === pkName,
    })),
  };
}

function findColumnId(table: CurrentTableSnapshot, columnName: string): string {
  const column = table.columns.find((item) => item.name === columnName);
  if (!column) {
    throw new Error(`column not found: ${table.name}.${columnName}`);
  }
  return column.id;
}

function createCurrentEdge(
  id: string,
  sourceTable: CurrentTableSnapshot,
  sourceColumnName: string,
  targetTable: CurrentTableSnapshot,
  targetColumnName: string,
  relationType: CurrentEdgeSnapshot['relationType'],
): CurrentEdgeSnapshot {
  const sourceColumnId = findColumnId(sourceTable, sourceColumnName);
  const targetColumnId = findColumnId(targetTable, targetColumnName);
  return {
    id,
    source: sourceTable.id,
    target: targetTable.id,
    sourceHandle: `${sourceTable.id}-${sourceColumnId}-source`,
    targetHandle: `${targetTable.id}-${targetColumnId}-target`,
    relationType,
  };
}

test('exact-name 매칭은 update 1건으로 계산된다', () => {
  const currentTables = [createCurrentTable('table-1', 'users', ['id', 'name'])];
  const nextTables = [createParsedTable('users', ['id', 'name'])];

  const plan = buildErdTableDiffPlan({
    currentTables,
    nextTables,
    now: 1700000000000,
  });

  assert.equal(plan.tables.length, 1);
  assert.equal(plan.tables[0]?.op, 'update');
  if (plan.tables[0]?.op === 'update') {
    assert.equal(plan.tables[0].match.strategy, 'exact-name');
    assert.equal(plan.tables[0].tableId, 'table-1');
  }
  assert.equal(plan.summary.totalOperations, 1);
});

test('exact-name 후보가 중복이면 보수 경로(add+delete-safety)로 처리한다', () => {
  const currentTables = [
    createCurrentTable('table-1', 'users', ['id', 'name']),
    createCurrentTable('table-2', 'users', ['id', 'name']),
  ];
  const nextTables = [createParsedTable('users', ['id', 'name'])];

  const plan = buildErdTableDiffPlan({
    currentTables,
    nextTables,
    now: 1700000000000,
  });

  const updates = plan.tables.filter((item) => item.op === 'update');
  const adds = plan.tables.filter((item) => item.op === 'add');
  const safetyDeletes = plan.tables.filter(
    (item) => item.op === 'delete' && item.reason === 'delete-add-safety',
  );

  assert.equal(updates.length, 0);
  assert.equal(adds.length, 1);
  assert.equal(safetyDeletes.length, 2);
  assert.equal(plan.meta.fallbackRequired, true);
  assert.deepEqual(plan.meta.fallbackReasons, ['unsafe-match-detected']);
});

test('rename 승격 조건을 만족하면 update(rename)로 계산된다', () => {
  const currentTables = [createCurrentTable('table-1', 'users', ['id', 'name', 'email'])];
  const nextTables = [createParsedTable('members', ['id', 'name', 'email'])];

  const plan = buildErdTableDiffPlan({
    currentTables,
    nextTables,
    now: 1700000000000,
  });

  assert.equal(plan.tables.length, 1);
  assert.equal(plan.tables[0]?.op, 'update');
  assert.equal(plan.meta.fallbackRequired, false);
  assert.deepEqual(plan.meta.fallbackReasons, []);
  if (plan.tables[0]?.op === 'update') {
    assert.equal(plan.tables[0].match.strategy, 'rename-promoted');
    assert.equal(plan.tables[0].rename?.from, 'users');
    assert.equal(plan.tables[0].rename?.to, 'members');
  }
});

test('rename 후보가 다수면 보수 정책으로 add+delete 처리된다', () => {
  const currentTables = [
    createCurrentTable('table-1', 'users', ['id', 'name', 'email']),
    createCurrentTable('table-2', 'users_history', ['id', 'name', 'email']),
  ];
  const nextTables = [createParsedTable('members', ['id', 'name', 'email'])];

  const plan = buildErdTableDiffPlan({
    currentTables,
    nextTables,
    now: 1700000000000,
  });

  const adds = plan.tables.filter((item) => item.op === 'add');
  const deletes = plan.tables.filter((item) => item.op === 'delete');

  assert.equal(adds.length, 1);
  assert.equal(deletes.length, 2);
  assert.equal(
    deletes.every((item) => item.reason === 'delete-add-safety'),
    true,
  );
  assert.equal(plan.meta.fallbackRequired, true);
  assert.deepEqual(plan.meta.fallbackReasons, ['unsafe-match-detected']);
});

test('관계 이웃 시그니처가 충돌하면 rename을 승격하지 않는다', () => {
  const currentTables = [
    createCurrentTable('table-1', 'users', ['id', 'team_id', 'name']),
    createCurrentTable('table-2', 'teams', ['id', 'name']),
  ];
  const currentEdges: CurrentEdgeSnapshot[] = [
    {
      id: 'edge-1',
      source: 'table-2',
      target: 'table-1',
      relationType: 'non-identifying',
    },
  ];
  const nextTables = [createParsedTable('members', ['id', 'team_id', 'name'])];
  const nextRelations: DiffParsedRelation[] = [
    {
      parentTable: 'departments',
      parentColumn: 'id',
      childTable: 'members',
      childColumn: 'team_id',
    },
  ];

  const plan = buildErdTableDiffPlan({
    currentTables,
    currentEdges,
    nextTables,
    nextRelations,
    now: 1700000000000,
  });

  const hasRenameUpdate = plan.tables.some(
    (item) => item.op === 'update' && item.match.strategy === 'rename-promoted',
  );
  const hasAdd = plan.tables.some((item) => item.op === 'add');
  const hasSafetyDelete = plan.tables.some(
    (item) => item.op === 'delete' && item.reason === 'delete-add-safety',
  );

  assert.equal(hasRenameUpdate, false);
  assert.equal(hasAdd, true);
  assert.equal(hasSafetyDelete, true);
});

test('exact-match 이웃이 있어도 rename 관계 충돌 검증이 유지된다', () => {
  const currentTables = [
    createCurrentTable('table-1', 'users', ['id', 'team_id', 'name']),
    createCurrentTable('table-2', 'teams', ['id', 'name']),
  ];
  const currentEdges: CurrentEdgeSnapshot[] = [
    {
      id: 'edge-1',
      source: 'table-2',
      target: 'table-1',
      sourceHandle: `${currentTables[1].id}-${findColumnId(currentTables[1], 'id')}-source`,
      targetHandle: `${currentTables[0].id}-${findColumnId(currentTables[0], 'team_id')}-target`,
      relationType: 'non-identifying',
    },
  ];
  const nextTables = [
    createParsedTable('teams', ['id', 'name']), // exact-name 매칭으로 먼저 소진
    createParsedTable('members', ['id', 'team_id', 'name']),
  ];
  const nextRelations: DiffParsedRelation[] = [
    {
      parentTable: 'departments',
      parentColumn: 'id',
      childTable: 'members',
      childColumn: 'team_id',
    },
  ];

  const plan = buildErdTableDiffPlan({
    currentTables,
    currentEdges,
    nextTables,
    nextRelations,
    now: 1700000000000,
  });

  const hasUsersRename = plan.tables.some(
    (item) =>
      item.op === 'update' &&
      item.tableId === 'table-1' &&
      item.match.strategy === 'rename-promoted',
  );
  const hasMembersAdd = plan.tables.some(
    (item) => item.op === 'add' && item.next.name === 'members',
  );
  const hasUsersSafetyDelete = plan.tables.some(
    (item) =>
      item.op === 'delete' && item.tableId === 'table-1' && item.reason === 'delete-add-safety',
  );
  const hasTeamsExactUpdate = plan.tables.some(
    (item) =>
      item.op === 'update' && item.tableId === 'table-2' && item.match.strategy === 'exact-name',
  );

  assert.equal(hasUsersRename, false);
  assert.equal(hasMembersAdd, true);
  assert.equal(hasUsersSafetyDelete, true);
  assert.equal(hasTeamsExactUpdate, true);
});

test('컬럼 diff는 update 테이블에서 add/update/delete를 계산한다', () => {
  const currentTables = [createCurrentTable('table-1', 'users', ['id', 'name', 'legacy_code'])];
  const nextTables = [createParsedTable('users', ['id', 'name', 'email'])];
  nextTables[0].columns[1].type = 'VARCHAR(240)';

  const plan = buildErdTableDiffPlan({
    currentTables,
    nextTables,
    now: 1700000000000,
  });

  const columnAdds = plan.columns.filter((item) => item.op === 'add');
  const columnUpdates = plan.columns.filter((item) => item.op === 'update');
  const columnDeletes = plan.columns.filter((item) => item.op === 'delete');

  assert.equal(columnAdds.length, 1);
  assert.equal(columnAdds[0]?.next.name, 'email');
  assert.equal(columnUpdates.length, 1);
  if (columnUpdates[0]?.op === 'update') {
    assert.equal(columnUpdates[0].current.name, 'name');
    assert.equal(columnUpdates[0].next.type, 'VARCHAR(240)');
  }
  assert.equal(columnDeletes.length, 1);
  if (columnDeletes[0]?.op === 'delete') {
    assert.equal(columnDeletes[0].current.name, 'legacy_code');
  }
});

test('관계 diff는 add/update/delete를 계산한다', () => {
  const users = createCurrentTable('table-1', 'users', ['id', 'team_id', 'old_parent_id']);
  const teams = createCurrentTable('table-2', 'teams', ['id', 'name']);
  const oldParents = createCurrentTable('table-3', 'old_parents', ['id', 'name']);

  const currentTables = [users, teams, oldParents];
  const currentEdges: CurrentEdgeSnapshot[] = [
    createCurrentEdge('edge-1', teams, 'id', users, 'team_id', 'identifying'),
    createCurrentEdge('edge-2', oldParents, 'id', users, 'old_parent_id', 'non-identifying'),
  ];

  const nextTables = [
    createParsedTable('users', ['id', 'team_id', 'dept_id']),
    createParsedTable('teams', ['id', 'name']),
    createParsedTable('departments', ['id', 'name']),
  ];
  const nextRelations: DiffParsedRelation[] = [
    {
      parentTable: 'teams',
      parentColumn: 'id',
      childTable: 'users',
      childColumn: 'team_id',
    },
    {
      parentTable: 'departments',
      parentColumn: 'id',
      childTable: 'users',
      childColumn: 'dept_id',
    },
  ];

  const plan = buildErdTableDiffPlan({
    currentTables,
    currentEdges,
    nextTables,
    nextRelations,
    now: 1700000000000,
  });

  const edgeAdds = plan.edges.filter((item) => item.op === 'add');
  const edgeUpdates = plan.edges.filter((item) => item.op === 'update');
  const edgeDeletes = plan.edges.filter((item) => item.op === 'delete');

  assert.equal(edgeAdds.length, 1);
  if (edgeAdds[0]?.op === 'add') {
    assert.equal(edgeAdds[0].next.parentTable, 'departments');
  }
  assert.equal(edgeUpdates.length, 1);
  if (edgeUpdates[0]?.op === 'update') {
    assert.equal(edgeUpdates[0].edgeId, 'edge-1');
    assert.equal(edgeUpdates[0].nextRelationType, 'non-identifying');
  }
  assert.equal(edgeDeletes.length, 1);
  if (edgeDeletes[0]?.op === 'delete') {
    assert.equal(edgeDeletes[0].edgeId, 'edge-2');
  }
});
