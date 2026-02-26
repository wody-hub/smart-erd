import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as Y from 'yjs';
import { applyDiffToYDoc } from '../../src/lib/erd-diff-apply.js';
import { buildDiffPlanSummary, type DiffPlan } from '../../src/lib/erd-diff-plan.js';

interface SeedColumn {
  id: string;
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  nullable?: boolean;
  autoIncrement?: boolean;
}

interface SeedTable {
  id: string;
  label: string;
  x: number;
  y: number;
  columns: SeedColumn[];
}

interface SeedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  relationType: 'identifying' | 'non-identifying';
}

function createDoc(seed: {
  tables: SeedTable[];
  edges: SeedEdge[];
  groups?: Array<{ id: string; label: string; tableIds: string[] }>;
}): Y.Doc {
  const doc = new Y.Doc();
  const tablesMap = doc.getMap('tables') as Y.Map<Y.Map<unknown>>;
  const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<unknown>>;
  const groupsMap = doc.getMap('groups') as Y.Map<Y.Map<unknown>>;

  doc.transact(() => {
    for (const table of seed.tables) {
      const tableYMap = new Y.Map<unknown>();
      tableYMap.set('label', table.label);

      const posYMap = new Y.Map<number>();
      posYMap.set('x', table.x);
      posYMap.set('y', table.y);
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

    for (const edge of seed.edges) {
      const edgeYMap = new Y.Map<unknown>();
      edgeYMap.set('source', edge.source);
      edgeYMap.set('target', edge.target);
      edgeYMap.set('sourceHandle', edge.sourceHandle);
      edgeYMap.set('targetHandle', edge.targetHandle);
      edgeYMap.set('relationType', edge.relationType);
      edgesMap.set(edge.id, edgeYMap);
    }

    for (const group of seed.groups ?? []) {
      const groupYMap = new Y.Map<unknown>();
      groupYMap.set('label', group.label);
      const tableIdsYArray = new Y.Array<string>();
      tableIdsYArray.push(group.tableIds);
      groupYMap.set('tableIds', tableIdsYArray);
      groupsMap.set(group.id, groupYMap);
    }
  });

  return doc;
}

function getTableByLabel(doc: Y.Doc, label: string): { id: string; yMap: Y.Map<unknown> } | null {
  const tablesMap = doc.getMap('tables') as Y.Map<Y.Map<unknown>>;
  for (const [id, yMap] of tablesMap.entries()) {
    if (yMap.get('label') === label) {
      return { id, yMap };
    }
  }
  return null;
}

function getColumnByName(tableYMap: Y.Map<unknown>, name: string): Y.Map<unknown> | null {
  const columnsYArray = tableYMap.get('columns') as Y.Array<Y.Map<unknown>> | undefined;
  if (!columnsYArray) {
    return null;
  }
  for (let i = 0; i < columnsYArray.length; i += 1) {
    const col = columnsYArray.get(i);
    if (col.get('name') === name) {
      return col;
    }
  }
  return null;
}

function buildPlanForApplyScenario(): DiffPlan {
  const tables: DiffPlan['tables'] = [
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-1',
      current: {
        id: 'table-1',
        name: 'users',
        position: { x: 100, y: 100 },
        columns: [
          {
            id: 'col-u-id',
            name: 'id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
            autoIncrement: true,
          },
          { id: 'col-u-name', name: 'name', type: 'VARCHAR(120)', nullable: false },
          { id: 'col-u-team', name: 'team_id', type: 'BIGINT', nullable: true },
          { id: 'col-u-old', name: 'old_parent_id', type: 'BIGINT', nullable: true },
        ],
      },
      next: {
        name: 'members',
        columns: [
          { name: 'id', type: 'BIGINT', pk: true, nullable: false, autoIncrement: true },
          {
            name: 'full_name',
            type: 'VARCHAR(200)',
            pk: false,
            nullable: false,
            autoIncrement: false,
          },
          { name: 'team_id', type: 'BIGINT', pk: false, nullable: true, autoIncrement: false },
          { name: 'dept_id', type: 'BIGINT', pk: false, nullable: true, autoIncrement: false },
        ],
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
      op: 'add',
      next: {
        name: 'departments',
        columns: [{ name: 'id', type: 'BIGINT', pk: true, nullable: false, autoIncrement: true }],
      },
    },
    {
      entity: 'table',
      op: 'delete',
      tableId: 'table-3',
      current: {
        id: 'table-3',
        name: 'old_parents',
        position: { x: 600, y: 100 },
        columns: [{ id: 'col-op-id', name: 'id', type: 'BIGINT', pk: true, nullable: false }],
      },
      reason: 'missing-in-next',
    },
  ];

  const columns: DiffPlan['columns'] = [
    {
      entity: 'column',
      op: 'update',
      tableId: 'table-1',
      columnId: 'col-u-name',
      current: { id: 'col-u-name', name: 'name', type: 'VARCHAR(120)', nullable: false },
      next: {
        name: 'full_name',
        type: 'VARCHAR(200)',
        pk: false,
        nullable: false,
        autoIncrement: false,
      },
    },
    {
      entity: 'column',
      op: 'delete',
      tableId: 'table-1',
      columnId: 'col-u-old',
      current: { id: 'col-u-old', name: 'old_parent_id', type: 'BIGINT', nullable: true },
    },
    {
      entity: 'column',
      op: 'add',
      tableId: 'table-1',
      nextIndex: 3,
      next: {
        name: 'dept_id',
        type: 'BIGINT',
        pk: false,
        nullable: true,
        autoIncrement: false,
      },
    },
  ];

  const edges: DiffPlan['edges'] = [
    {
      entity: 'edge',
      op: 'update',
      edgeId: 'edge-1',
      current: {
        id: 'edge-1',
        source: 'table-2',
        target: 'table-1',
        sourceHandle: 'table-2-col-t-id-source',
        targetHandle: 'table-1-col-u-team-target',
        relationType: 'identifying',
      },
      nextRelationType: 'non-identifying',
    },
    {
      entity: 'edge',
      op: 'delete',
      edgeId: 'edge-2',
      current: {
        id: 'edge-2',
        source: 'table-3',
        target: 'table-1',
        sourceHandle: 'table-3-col-op-id-source',
        targetHandle: 'table-1-col-u-old-target',
        relationType: 'non-identifying',
      },
    },
    {
      entity: 'edge',
      op: 'add',
      next: {
        parentTable: 'departments',
        parentColumn: 'id',
        childTable: 'members',
        childColumn: 'dept_id',
      },
      relationType: 'non-identifying',
    },
  ];

  return {
    meta: {
      createdAt: 1700000000000,
      version: 'v1',
      fallbackRequired: false,
      fallbackReasons: [],
    },
    tables,
    columns,
    edges,
    summary: buildDiffPlanSummary({ tables, columns, edges }),
  };
}

test('applyDiffToYDoc 는 증분 반영 후 테이블/관계/그룹 무결성을 유지한다', () => {
  const doc = createDoc({
    tables: [
      {
        id: 'table-1',
        label: 'users',
        x: 100,
        y: 100,
        columns: [
          {
            id: 'col-u-id',
            name: 'id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
            autoIncrement: true,
          },
          { id: 'col-u-name', name: 'name', type: 'VARCHAR(120)', nullable: false },
          { id: 'col-u-team', name: 'team_id', type: 'BIGINT', nullable: true, fk: true },
          { id: 'col-u-old', name: 'old_parent_id', type: 'BIGINT', nullable: true, fk: true },
        ],
      },
      {
        id: 'table-2',
        label: 'teams',
        x: 400,
        y: 100,
        columns: [{ id: 'col-t-id', name: 'id', type: 'BIGINT', pk: true, nullable: false }],
      },
      {
        id: 'table-3',
        label: 'old_parents',
        x: 700,
        y: 100,
        columns: [{ id: 'col-op-id', name: 'id', type: 'BIGINT', pk: true, nullable: false }],
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'table-2',
        target: 'table-1',
        sourceHandle: 'table-2-col-t-id-source',
        targetHandle: 'table-1-col-u-team-target',
        relationType: 'identifying',
      },
      {
        id: 'edge-2',
        source: 'table-3',
        target: 'table-1',
        sourceHandle: 'table-3-col-op-id-source',
        targetHandle: 'table-1-col-u-old-target',
        relationType: 'non-identifying',
      },
    ],
    groups: [{ id: 'group-1', label: 'core', tableIds: ['table-1', 'table-3', 'ghost-table'] }],
  });

  const result = applyDiffToYDoc(doc, buildPlanForApplyScenario());
  assert.equal(result.applied, true);
  assert.equal(result.appliedOperations > 0, true);
  assert.equal(result.groupRemap.keptCount, 1);
  assert.equal(result.groupRemap.droppedCount, 2);
  assert.equal(result.groupRemap.droppedByMissing, 2);

  const members = getTableByLabel(doc, 'members');
  const teams = getTableByLabel(doc, 'teams');
  const departments = getTableByLabel(doc, 'departments');
  const oldParents = getTableByLabel(doc, 'old_parents');

  assert.equal(members != null, true);
  assert.equal(teams != null, true);
  assert.equal(departments != null, true);
  assert.equal(oldParents, null);
  assert.equal(members?.id, 'table-1');

  if (!members) {
    throw new Error('members table missing');
  }
  const fullNameCol = getColumnByName(members.yMap, 'full_name');
  const deptIdCol = getColumnByName(members.yMap, 'dept_id');
  const oldParentCol = getColumnByName(members.yMap, 'old_parent_id');

  assert.equal(fullNameCol?.get('type'), 'VARCHAR(200)');
  assert.equal(deptIdCol != null, true);
  assert.equal(oldParentCol, null);

  const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<unknown>>;
  assert.equal(edgesMap.has('edge-2'), false);
  const edge1 = edgesMap.get('edge-1');
  assert.equal(edge1?.get('relationType'), 'non-identifying');

  const addedEdge = [...edgesMap.values()].find((edgeYMap) => {
    const source = edgeYMap.get('source');
    const target = edgeYMap.get('target');
    return source === departments?.id && target === members.id;
  });
  assert.equal(addedEdge != null, true);
  assert.equal(deptIdCol?.get('fk'), true);

  const groupsMap = doc.getMap('groups') as Y.Map<Y.Map<unknown>>;
  const group = groupsMap.get('group-1');
  const tableIds = (group?.get('tableIds') as Y.Array<string> | undefined)?.toArray() ?? [];
  assert.deepEqual(tableIds, ['table-1']);
});

test('applyDiffToYDoc 는 빈 계획에서도 깨진 edge/group 참조를 정리한다', () => {
  const doc = createDoc({
    tables: [
      {
        id: 'table-1',
        label: 'users',
        x: 100,
        y: 100,
        columns: [{ id: 'col-u-id', name: 'id', type: 'BIGINT', pk: true, nullable: false }],
      },
    ],
    edges: [
      {
        id: 'edge-broken',
        source: 'table-1',
        target: 'table-1',
        sourceHandle: 'table-1-col-u-id-source',
        targetHandle: 'table-1-col-missing-target',
        relationType: 'non-identifying',
      },
    ],
    groups: [{ id: 'group-1', label: 'core', tableIds: ['table-1', 'ghost-table'] }],
  });

  const emptyPlan: DiffPlan = {
    meta: {
      createdAt: 1700000000000,
      version: 'v1',
      fallbackRequired: false,
      fallbackReasons: [],
    },
    tables: [],
    columns: [],
    edges: [],
    summary: buildDiffPlanSummary({ tables: [], columns: [], edges: [] }),
  };

  const result = applyDiffToYDoc(doc, emptyPlan);
  assert.equal(result.appliedOperations, 0);
  assert.equal(result.groupRemap.keptCount, 1);
  assert.equal(result.groupRemap.droppedCount, 1);
  assert.equal(result.groupRemap.droppedByMissing, 1);

  const edgesMap = doc.getMap('edges') as Y.Map<Y.Map<unknown>>;
  assert.equal(edgesMap.has('edge-broken'), false);

  const groupsMap = doc.getMap('groups') as Y.Map<Y.Map<unknown>>;
  const group = groupsMap.get('group-1');
  const tableIds = (group?.get('tableIds') as Y.Array<string> | undefined)?.toArray() ?? [];
  assert.deepEqual(tableIds, ['table-1']);
});

test('applyDiffToYDoc 는 confidence!=high update 테이블 멤버십을 그룹에서 제거한다', () => {
  const doc = createDoc({
    tables: [
      {
        id: 'table-1',
        label: 'users',
        x: 100,
        y: 100,
        columns: [{ id: 'col-u-id', name: 'id', type: 'BIGINT', pk: true, nullable: false }],
      },
    ],
    edges: [],
    groups: [{ id: 'group-1', label: 'core', tableIds: ['table-1'] }],
  });

  const tables: DiffPlan['tables'] = [
    {
      entity: 'table',
      op: 'update',
      tableId: 'table-1',
      current: {
        id: 'table-1',
        name: 'users',
        position: { x: 100, y: 100 },
        columns: [{ id: 'col-u-id', name: 'id', type: 'BIGINT', pk: true, nullable: false }],
      },
      next: {
        name: 'users',
        columns: [{ name: 'id', type: 'BIGINT', pk: true, nullable: false, autoIncrement: false }],
      },
      match: {
        strategy: 'delete-add',
        confidence: 'medium',
        candidateCount: 2,
        renameRejectReason: 'non-unique-candidate',
      },
    },
  ];

  const plan: DiffPlan = {
    meta: {
      createdAt: 1700000000000,
      version: 'v1',
      fallbackRequired: false,
      fallbackReasons: [],
    },
    tables,
    columns: [],
    edges: [],
    summary: buildDiffPlanSummary({ tables, columns: [], edges: [] }),
  };

  const result = applyDiffToYDoc(doc, plan);
  assert.equal(result.groupRemap.droppedByPolicy, 1);

  const groupsMap = doc.getMap('groups') as Y.Map<Y.Map<unknown>>;
  const group = groupsMap.get('group-1');
  const tableIds = (group?.get('tableIds') as Y.Array<string> | undefined)?.toArray() ?? [];
  assert.deepEqual(tableIds, []);
});
