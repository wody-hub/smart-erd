import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as Y from 'yjs';
import { applyDiffToYDoc } from '../../src/lib/erd-diff-apply.js';
import { buildErdTableDiffPlan } from '../../src/lib/erd-diff-builder.js';
import { buildFallbackGroupAssignments } from '../../src/lib/erd-fallback-group-remap.js';
import { buildStableEdgeId } from '../../src/lib/edge-handles.js';
import { extractColId } from '../../src/lib/handle-id.js';
import type {
  CurrentEdgeSnapshot,
  CurrentTableSnapshot,
  DiffParsedRelation,
  DiffParsedTable,
  TableDiff,
} from '../../src/lib/erd-diff-plan.js';

interface TestFixture {
  currentTables: CurrentTableSnapshot[];
  currentEdges: CurrentEdgeSnapshot[];
  nextTables: DiffParsedTable[];
  nextRelations: DiffParsedRelation[];
}

function createFixture(tableCount: number): TestFixture {
  const currentTables: CurrentTableSnapshot[] = [];
  for (let i = 1; i <= tableCount; i += 1) {
    const id = `table-${i}`;
    const columns = [
      {
        id: `col-${i}-id`,
        name: 'id',
        type: 'BIGINT',
        pk: true,
        nullable: false,
        autoIncrement: true,
      },
      {
        id: `col-${i}-code`,
        name: 'code',
        type: 'VARCHAR(64)',
        nullable: false,
      },
      {
        id: `col-${i}-name`,
        name: 'name',
        type: 'VARCHAR(120)',
        nullable: false,
      },
      {
        id: `col-${i}-created_at`,
        name: 'created_at',
        type: 'TIMESTAMP',
        nullable: false,
      },
    ];
    if (i > 1) {
      columns.push({
        id: `col-${i}-prev_id`,
        name: 'prev_id',
        type: 'BIGINT',
        nullable: true,
      });
    }

    currentTables.push({
      id,
      name: `table_${i}`,
      position: { x: 80 + ((i - 1) % 8) * 300, y: 80 + Math.floor((i - 1) / 8) * 250 },
      columns,
    });
  }

  const currentEdges: CurrentEdgeSnapshot[] = [];
  for (let i = 2; i <= tableCount; i += 1) {
    const parent = i - 1;
    currentEdges.push({
      id: `edge-${parent}-${i}`,
      source: `table-${parent}`,
      target: `table-${i}`,
      sourceHandle: `table-${parent}-col-${parent}-id-source`,
      targetHandle: `table-${i}-col-${i}-prev_id-target`,
      relationType: 'non-identifying',
    });
  }

  const nextTables: DiffParsedTable[] = currentTables.map((table) => ({
    name: table.name,
    columns: table.columns.map((column) => ({
      name: column.name,
      type: column.type,
      pk: Boolean(column.pk),
      nullable: Boolean(column.nullable),
      autoIncrement: Boolean(column.autoIncrement),
    })),
  }));

  const nextRelations: DiffParsedRelation[] = [];
  for (let i = 2; i <= tableCount; i += 1) {
    nextRelations.push({
      parentTable: `table_${i - 1}`,
      parentColumn: 'id',
      childTable: `table_${i}`,
      childColumn: 'prev_id',
    });
  }

  return { currentTables, currentEdges, nextTables, nextRelations };
}

function createDocFromCurrent(
  currentTables: CurrentTableSnapshot[],
  currentEdges: CurrentEdgeSnapshot[],
  groupedTableIds: string[] = [],
): Y.Doc {
  const doc = new Y.Doc();
  const tablesMap = doc.getMap('tables') as Y.Map<Y.Map<unknown>>;
  const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<unknown>>;
  const groupsMap = doc.getMap('groups') as Y.Map<Y.Map<unknown>>;

  doc.transact(() => {
    for (const table of currentTables) {
      const tableYMap = new Y.Map<unknown>();
      tableYMap.set('label', table.name);

      const posYMap = new Y.Map<number>();
      posYMap.set('x', table.position.x);
      posYMap.set('y', table.position.y);
      tableYMap.set('position', posYMap);

      const columnsYArray = new Y.Array<Y.Map<unknown>>();
      for (const column of table.columns) {
        const colYMap = new Y.Map<unknown>();
        colYMap.set('id', column.id);
        colYMap.set('name', column.name);
        colYMap.set('type', column.type);
        if (column.pk) colYMap.set('pk', true);
        if (column.fk) colYMap.set('fk', true);
        if (column.nullable !== undefined) colYMap.set('nullable', column.nullable);
        if (column.autoIncrement) colYMap.set('autoIncrement', true);
        columnsYArray.push([colYMap]);
      }
      tableYMap.set('columns', columnsYArray);
      tablesMap.set(table.id, tableYMap);
    }

    for (const edge of currentEdges) {
      const edgeYMap = new Y.Map<unknown>();
      edgeYMap.set('source', edge.source);
      edgeYMap.set('target', edge.target);
      if (edge.sourceHandle) edgeYMap.set('sourceHandle', edge.sourceHandle);
      if (edge.targetHandle) edgeYMap.set('targetHandle', edge.targetHandle);
      edgeYMap.set('relationType', edge.relationType);
      if (edge.routingType) edgeYMap.set('routingType', edge.routingType);
      if (edge.handleMode) edgeYMap.set('handleMode', edge.handleMode);
      if (edge.sourceSide) edgeYMap.set('sourceSide', edge.sourceSide);
      if (edge.targetSide) edgeYMap.set('targetSide', edge.targetSide);
      if (edge.waypoints?.length) {
        const waypointsYArray = new Y.Array<Y.Map<unknown>>();
        for (const waypoint of edge.waypoints) {
          const waypointYMap = new Y.Map<unknown>();
          waypointYMap.set('x', waypoint.x);
          waypointYMap.set('y', waypoint.y);
          waypointsYArray.push([waypointYMap]);
        }
        edgeYMap.set('waypoints', waypointsYArray);
      }
      edgesMap.set(edge.id, edgeYMap);
    }

    const groupYMap = new Y.Map<unknown>();
    groupYMap.set('label', 'regression-group');
    const groupTableIds = new Y.Array<string>();
    groupTableIds.push(groupedTableIds);
    groupYMap.set('tableIds', groupTableIds);
    groupsMap.set('group-1', groupYMap);
  });

  return doc;
}

function getTableById(doc: Y.Doc, tableId: string): Y.Map<unknown> | undefined {
  const tablesMap = doc.getMap('tables') as Y.Map<Y.Map<unknown>>;
  return tablesMap.get(tableId);
}

function getColumnByName(tableYMap: Y.Map<unknown>, name: string): Y.Map<unknown> | undefined {
  const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
  if (!columnsYArray) {
    return undefined;
  }
  for (let i = 0; i < columnsYArray.length; i += 1) {
    const colYMap = columnsYArray.get(i);
    if (colYMap.get('name') === name) {
      return colYMap;
    }
  }
  return undefined;
}

function resolveTargetColumnName(
  doc: Y.Doc,
  edgeYMap: Y.Map<unknown>,
): { targetTableId: string; targetColumnName: string } | null {
  const targetTableId = edgeYMap.get('target');
  const targetHandle = edgeYMap.get('targetHandle');
  if (typeof targetTableId !== 'string' || typeof targetHandle !== 'string') {
    return null;
  }
  const prefix = `${targetTableId}-`;
  if (!targetHandle.startsWith(prefix)) {
    return null;
  }
  const colId = extractColId(targetHandle, targetTableId);
  const tableYMap = getTableById(doc, targetTableId);
  if (!tableYMap) {
    return null;
  }
  const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
  if (!columnsYArray) {
    return null;
  }
  for (let i = 0; i < columnsYArray.length; i += 1) {
    const col = columnsYArray.get(i);
    if (col.get('id') === colId) {
      const name = col.get('name');
      if (typeof name === 'string') {
        return { targetTableId, targetColumnName: name };
      }
      return null;
    }
  }
  return null;
}

test('regression:no-op 대용량 시나리오에서 add/delete 없이 안정 동작한다', () => {
  const fixture = createFixture(120);
  const doc = createDocFromCurrent(fixture.currentTables, fixture.currentEdges, [
    'table-40',
    'table-80',
  ]);

  const plan = buildErdTableDiffPlan({
    currentTables: fixture.currentTables,
    currentEdges: fixture.currentEdges,
    nextTables: fixture.nextTables,
    nextRelations: fixture.nextRelations,
    now: 1700000000000,
  });

  assert.equal(plan.summary.tableAdds, 0);
  assert.equal(plan.summary.tableDeletes, 0);
  assert.equal(plan.summary.columnAdds, 0);
  assert.equal(plan.summary.columnUpdates, 0);
  assert.equal(plan.summary.columnDeletes, 0);
  assert.equal(plan.summary.edgeAdds, 0);
  assert.equal(plan.summary.edgeUpdates, 0);
  assert.equal(plan.summary.edgeDeletes, 0);

  const result = applyDiffToYDoc(doc, plan);
  assert.equal(result.skippedOperations, 0);

  const tablesMap = doc.getMap('tables') as Y.Map<Y.Map<unknown>>;
  const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<unknown>>;
  assert.equal(tablesMap.size, 120);
  assert.equal(edgesMap.size, 119);
});

test('regression:rename 시나리오에서 ID 유지 + rename 승격이 동작한다', () => {
  const fixture = createFixture(80);
  const renamedIndex = 40;
  const oldName = `table_${renamedIndex}`;
  const newName = 'customer_orders';

  fixture.nextTables[renamedIndex - 1].name = newName;
  fixture.nextRelations = fixture.nextRelations.map((relation) => ({
    ...relation,
    parentTable: relation.parentTable === oldName ? newName : relation.parentTable,
    childTable: relation.childTable === oldName ? newName : relation.childTable,
  }));

  const doc = createDocFromCurrent(fixture.currentTables, fixture.currentEdges, [
    `table-${renamedIndex}`,
  ]);
  const plan = buildErdTableDiffPlan({
    currentTables: fixture.currentTables,
    currentEdges: fixture.currentEdges,
    nextTables: fixture.nextTables,
    nextRelations: fixture.nextRelations,
    now: 1700000000000,
  });

  const renameDiff = plan.tables.find(
    (diff) => diff.op === 'update' && diff.tableId === `table-${renamedIndex}`,
  );
  assert.equal(renameDiff?.op, 'update');
  if (renameDiff?.op === 'update') {
    assert.equal(renameDiff.match.strategy, 'rename-promoted');
    assert.equal(renameDiff.rename?.from, oldName);
    assert.equal(renameDiff.rename?.to, newName);
  }

  applyDiffToYDoc(doc, plan);
  const renamedTable = getTableById(doc, `table-${renamedIndex}`);
  assert.equal(renamedTable?.get('label'), newName);

  const group = (doc.getMap('groups') as Y.Map<Y.Map<unknown>>).get('group-1');
  const tableIds = (group?.get('tableIds') as Y.Array<string> | undefined)?.toArray() ?? [];
  assert.deepEqual(tableIds, [`table-${renamedIndex}`]);
});

test('regression:partial-update 시나리오에서 컬럼/관계 변경이 누락 없이 반영된다', () => {
  const fixture = createFixture(60);
  const target = 30;
  const targetTable = fixture.nextTables[target - 1];
  targetTable.columns = targetTable.columns
    .filter((column) => column.name !== 'prev_id')
    .map((column) =>
      column.name === 'code'
        ? {
            ...column,
            type: 'VARCHAR(128)',
          }
        : column,
    );
  targetTable.columns.push({
    name: 'dept_id',
    type: 'BIGINT',
    pk: false,
    nullable: true,
    autoIncrement: false,
  });

  fixture.nextRelations = fixture.nextRelations.filter(
    (relation) =>
      !(relation.childTable === `table_${target}` && relation.childColumn === 'prev_id'),
  );
  fixture.nextRelations.push({
    parentTable: 'table_10',
    parentColumn: 'id',
    childTable: `table_${target}`,
    childColumn: 'dept_id',
  });

  const doc = createDocFromCurrent(fixture.currentTables, fixture.currentEdges, [
    `table-${target}`,
  ]);
  const plan = buildErdTableDiffPlan({
    currentTables: fixture.currentTables,
    currentEdges: fixture.currentEdges,
    nextTables: fixture.nextTables,
    nextRelations: fixture.nextRelations,
    now: 1700000000000,
  });

  assert.equal(plan.summary.columnAdds > 0, true);
  assert.equal(plan.summary.columnUpdates > 0, true);
  assert.equal(plan.summary.columnDeletes > 0, true);
  assert.equal(plan.summary.edgeAdds > 0, true);
  assert.equal(plan.summary.edgeDeletes > 0, true);

  applyDiffToYDoc(doc, plan);
  const tableYMap = getTableById(doc, `table-${target}`);
  assert.equal(tableYMap != null, true);
  if (!tableYMap) {
    throw new Error('target table missing');
  }
  assert.equal(getColumnByName(tableYMap, 'prev_id'), undefined);
  assert.equal(getColumnByName(tableYMap, 'dept_id') != null, true);
  assert.equal(getColumnByName(tableYMap, 'code')?.get('type'), 'VARCHAR(128)');

  const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<unknown>>;
  let hasDeptRelation = false;
  let hasLegacyPrevRelation = false;
  edgesMap.forEach((edgeYMap) => {
    const targetInfo = resolveTargetColumnName(doc, edgeYMap);
    if (!targetInfo || targetInfo.targetTableId !== `table-${target}`) {
      return;
    }
    if (targetInfo.targetColumnName === 'dept_id') {
      hasDeptRelation = true;
    }
    if (targetInfo.targetColumnName === 'prev_id') {
      hasLegacyPrevRelation = true;
    }
  });
  assert.equal(hasDeptRelation, true);
  assert.equal(hasLegacyPrevRelation, false);
});

test('regression:edge 재생성 시 기존 manual side 와 routingType 을 carry-over 한다', () => {
  const fixture = createFixture(2);
  fixture.currentEdges = [
    {
      id: 'legacy-edge',
      source: 'table-1',
      target: 'table-2',
      sourceHandle: 'table-1-col-1-id-source-right',
      targetHandle: 'table-2-col-2-prev_id-target-right',
      relationType: 'non-identifying',
      routingType: 'bezier',
      handleMode: 'manual',
      sourceSide: 'right',
      targetSide: 'right',
    },
  ];

  const doc = createDocFromCurrent(fixture.currentTables, fixture.currentEdges);
  const currentEdge = fixture.currentEdges[0];
  const nextEdgeId = buildStableEdgeId({
    parentTable: 'table_1',
    parentColumn: 'id',
    childTable: 'table_2',
    childColumn: 'prev_id',
  });
  const plan = {
    meta: {
      createdAt: 1700000000000,
      version: 'v1' as const,
      fallbackRequired: false,
      fallbackReasons: [],
    },
    tables: [],
    columns: [],
    edges: [
      {
        entity: 'edge' as const,
        op: 'delete' as const,
        edgeId: currentEdge.id,
        current: currentEdge,
      },
      {
        entity: 'edge' as const,
        op: 'add' as const,
        next: {
          parentTable: 'table_1',
          parentColumn: 'id',
          childTable: 'table_2',
          childColumn: 'prev_id',
        },
        relationType: 'non-identifying' as const,
        routingType: 'smoothstep' as const,
      },
    ],
    summary: {
      tableAdds: 0,
      tableUpdates: 0,
      tableDeletes: 0,
      columnAdds: 0,
      columnUpdates: 0,
      columnDeletes: 0,
      edgeAdds: 1,
      edgeUpdates: 0,
      edgeDeletes: 1,
      totalOperations: 2,
    },
  };

  applyDiffToYDoc(doc, plan);
  const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<unknown>>;
  assert.equal(edgesMap.has('legacy-edge'), false);
  const edgeYMap = edgesMap.get(nextEdgeId);
  assert.equal(edgeYMap != null, true);
  assert.equal(edgeYMap?.get('routingType'), 'bezier');
  assert.equal(edgeYMap?.get('handleMode'), 'manual');
  assert.equal(edgeYMap?.get('sourceSide'), 'right');
  assert.equal(edgeYMap?.get('targetSide'), 'right');
  assert.equal(edgeYMap?.get('sourceHandle'), 'table-1-col-1-id-source-right');
  assert.equal(edgeYMap?.get('targetHandle'), 'table-2-col-2-prev_id-target-right');
});

test('regression:edge 재생성 시 same binding straight waypoint 를 carry-over 한다', () => {
  const fixture = createFixture(2);
  fixture.currentEdges = [
    {
      id: 'legacy-edge',
      source: 'table-1',
      target: 'table-2',
      sourceHandle: 'table-1-col-1-id-source-right',
      targetHandle: 'table-2-col-2-prev_id-target-right',
      relationType: 'non-identifying',
      routingType: 'straight',
      handleMode: 'manual',
      sourceSide: 'right',
      targetSide: 'right',
      waypoints: [
        { x: 540, y: 120 },
        { x: 540, y: 260 },
      ],
    },
  ];

  const doc = createDocFromCurrent(fixture.currentTables, fixture.currentEdges);
  const nextEdgeId = buildStableEdgeId({
    parentTable: 'table_1',
    parentColumn: 'id',
    childTable: 'table_2',
    childColumn: 'prev_id',
  });
  const plan = {
    meta: {
      createdAt: 1700000000000,
      version: 'v1' as const,
      fallbackRequired: false,
      fallbackReasons: [],
    },
    tables: [],
    columns: [],
    edges: [
      {
        entity: 'edge' as const,
        op: 'delete' as const,
        edgeId: 'legacy-edge',
        current: fixture.currentEdges[0],
      },
      {
        entity: 'edge' as const,
        op: 'add' as const,
        next: {
          parentTable: 'table_1',
          parentColumn: 'id',
          childTable: 'table_2',
          childColumn: 'prev_id',
        },
        relationType: 'non-identifying' as const,
        routingType: 'smoothstep' as const,
      },
    ],
    summary: {
      tableAdds: 0,
      tableUpdates: 0,
      tableDeletes: 0,
      columnAdds: 0,
      columnUpdates: 0,
      columnDeletes: 0,
      edgeAdds: 1,
      edgeUpdates: 0,
      edgeDeletes: 1,
      totalOperations: 2,
    },
  };

  applyDiffToYDoc(doc, plan);
  const edgeYMap = (doc.getMap('edges') as Y.Map<Y.Map<unknown>>).get(nextEdgeId);
  assert.equal(edgeYMap?.get('routingType'), 'straight');
  const waypointsYArray = edgeYMap?.get('waypoints') as Y.Array<Y.Map<unknown>> | undefined;
  assert.equal(waypointsYArray?.length, 2);
  assert.deepEqual(
    waypointsYArray?.toArray().map((waypointYMap) => ({
      x: waypointYMap.get('x'),
      y: waypointYMap.get('y'),
    })),
    [
      { x: 540, y: 120 },
      { x: 540, y: 260 },
    ],
  );
});

test('regression:fallback 그룹 재매핑에서 고신뢰 매칭만 유지된다', () => {
  const groups = [{ id: 'group-1', tableIds: ['table-1', 'table-2', 'table-3'] }];
  const tableDiffs: TableDiff[] = [
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-1',
      current: { id: 'table-1', name: 'users', position: { x: 0, y: 0 }, columns: [] },
      next: { name: 'members', columns: [] },
      match: { strategy: 'rename-promoted', confidence: 'high', candidateCount: 1 },
      rename: { from: 'users', to: 'members' },
    },
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-2',
      current: { id: 'table-2', name: 'legacy_users', position: { x: 0, y: 0 }, columns: [] },
      next: { name: 'legacy_users_v2', columns: [] },
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
      current: { id: 'table-3', name: 'tmp', position: { x: 0, y: 0 }, columns: [] },
      reason: 'missing-in-next',
    },
  ];
  const nextNodes = [
    { id: 'table-n1', data: { label: 'members' } },
    { id: 'table-n2', data: { label: 'legacy_users_v2' } },
  ];

  const assignments = buildFallbackGroupAssignments(groups, [...tableDiffs], nextNodes);
  assert.equal(assignments.length, 1);
  assert.deepEqual(assignments[0], {
    groupId: 'group-1',
    tableIds: ['table-n1'],
    droppedCount: 2,
  });
});
