import { ErdDocumentReadContextFactory } from '@/collaboration/plugins/erd/query/erd-document-read-context-factory';
import { collectErdAffectedScopesFromTransaction } from '@/collaboration/plugins/erd/erd-yjs-update-scope-collector';
import { buildErdColumnEntityId } from '@/collaboration/plugins/erd/erd-column-entity-id';
import { findColumnYMap } from '@/lib/erd-yjs-utils';
import { createCanvasTableActions } from '@/stores/canvas/canvasTableActions';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as Y from 'yjs';
import { ensureColumnStorage } from '@/collaboration/yjs-columns';
import { ErdDocumentMutationApplier } from '@/collaboration/plugins/erd/erd-document-mutation-applier';
import {
  createColumnYMap,
  deleteColumnFromYArray,
  getTablesMap,
  migrateJsonToYDoc,
  moveColumnInYArray,
  yDocToJson,
  yTablesMapToNodes,
} from '@/collaboration/yjsBridge';
import { applyDiffToYDoc, buildColumnFieldPatch } from '@/lib/erd-diff-apply';
import { buildDiffPlanSummary, type DiffPlan } from '@/lib/erd-diff-plan';

/**
 * 레거시 컬럼 배열만 있는 문서를 만든다.
 * @returns 테스트 문서
 */
function legacyDoc(): Y.Doc {
  const doc = new Y.Doc();
  const table = new Y.Map<unknown>();
  const columns = new Y.Array<Y.Map<unknown>>();
  columns.push(
    ['a', 'b', 'c'].map((id) =>
      createColumnYMap({
        id,
        name: id,
        type: 'INT',
        nullable: true,
        logicalName: `논리 ${id}`,
        termId: 7,
        domainId: 12,
        ...(id === 'b' ? { pk: true, autoIncrement: true, fk: true } : {}),
      }),
    ),
  );
  table.set('label', 'items');
  table.set('positionX', 10);
  table.set('positionY', 20);
  table.set('columns', columns);
  getTablesMap(doc).set('t', table);
  return doc;
}

/**
 * 실제 플러그인으로 컬럼 mutation을 적용한다.
 * @param doc 대상 문서
 * @param key mutation 키
 * @param payload mutation 데이터
 * @returns 적용 여부
 */
function mutate(doc: Y.Doc, key: string, payload: Record<string, unknown>): boolean {
  return new ErdDocumentMutationApplier({ getDocument: () => doc } as never).apply({
    key,
    payload: { tableId: 't', ...payload },
    affectedScopes: [],
  }).applied;
}

/**
 * 두 문서의 update를 양방향 교환하고 읽기 결과 수렴을 확인한다.
 * @param a 첫 문서
 * @param b 둘째 문서
 * @returns 없음
 */
function merge(a: Y.Doc, b: Y.Doc): void {
  const updateA = Y.encodeStateAsUpdate(a);
  const updateB = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(a, updateB);
  Y.applyUpdate(b, updateA);
  assert.equal(yDocToJson(a), yDocToJson(b));
}

/**
 * 컬럼 mutation 전에 동기화된 두 피어를 만든다.
 * @param migrated 마이그레이션 여부
 * @returns 두 피어
 */
function peers(migrated = true): [Y.Doc, Y.Doc] {
  const a = legacyDoc();
  if (migrated) mutate(a, 'column:update', { colId: 'a', type: 'INT' });
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return [a, b];
}

/**
 * 현재 컬럼을 공용 읽기 경로로 조회한다.
 * @param doc 대상 문서
 * @returns 컬럼 목록
 */
function columns(doc: Y.Doc) {
  return yTablesMapToNodes(getTablesMap(doc))[0]!.data.columns;
}

for (const migrated of [true, false]) {
  test(`move + field edit converges without losing edits (migrated=${migrated})`, () => {
    const [a, b] = peers(migrated);
    mutate(a, 'column:move', { fromIndex: 0, toIndex: 2 });
    mutate(b, 'column:update', { colId: 'a', type: 'TEXT' });
    merge(a, b);
    assert.deepEqual(
      columns(a).map((column) => column.id),
      ['b', 'c', 'a'],
    );
    assert.equal(columns(a)[2]!.type, 'TEXT');
  });

  test(`concurrent moves have one visible entry per id (migrated=${migrated})`, () => {
    const [a, b] = peers(migrated);
    mutate(a, 'column:move', { fromIndex: 0, toIndex: 1 });
    mutate(b, 'column:move', { fromIndex: 0, toIndex: 2 });
    merge(a, b);
    assert.equal(columns(a).length, 3);
    assert.equal(new Set(columns(a).map((column) => column.id)).size, 3);
  });

  test(`delete wins over concurrent and late edits (migrated=${migrated})`, () => {
    const [a, b] = peers(migrated);
    mutate(a, 'column:delete', { colId: 'a' });
    mutate(b, 'column:update', { colId: 'a', type: 'TEXT' });
    merge(a, b);
    assert.deepEqual(
      columns(a).map((column) => column.id),
      ['b', 'c'],
    );
    assert.equal(mutate(b, 'column:update', { colId: 'a', type: 'FLOAT' }), false);
    merge(a, b);
  });
}

test('legacy reads do not migrate; first write preserves fields and the legacy array', () => {
  const doc = legacyDoc();
  const table = getTablesMap(doc).get('t')!;
  const before = yDocToJson(doc);
  const legacy = (table.get('columns') as Y.Array<Y.Map<unknown>>).toJSON();
  assert.equal(table.has('columnsById'), false);
  mutate(doc, 'column:update', { colId: 'a', type: 'INT' });
  assert.ok(table.get('columnsById') instanceof Y.Map);
  assert.ok(table.get('columnOrder') instanceof Y.Array);
  assert.equal(yDocToJson(doc), before);
  mutate(doc, 'column:update', { colId: 'a', type: 'TEXT' });
  assert.deepEqual((table.get('columns') as Y.Array<Y.Map<unknown>>).toJSON(), legacy);
});

test('reader dedupes order, ignores missing bodies and appends unordered bodies by id', () => {
  const [a, b] = peers();
  for (const doc of [a, b]) {
    const table = getTablesMap(doc).get('t')!;
    const order = table.get('columnOrder') as Y.Array<string>;
    const bodies = table.get('columnsById') as Y.Map<Y.Map<unknown>>;
    bodies.set('z', createColumnYMap({ id: 'z', name: 'z', type: 'INT' }));
    bodies.set('d', createColumnYMap({ id: 'd', name: 'd', type: 'INT' }));
    assert.ok(order instanceof Y.Array);
    doc.transact(() => {
      order.delete(0, order.length);
      order.push(['b', 'b', 'missing', 'a', 'a']);
    });
  }
  merge(a, b);
  assert.deepEqual(
    columns(a).map((column) => column.id),
    ['b', 'a', 'c', 'd', 'z'],
  );
});

for (const migrated of [true, false]) {
  test(`JSON round trip preserves the public snapshot (migrated=${migrated})`, () => {
    const [doc] = peers(migrated);
    const json = yDocToJson(doc);
    const restored = new Y.Doc();
    migrateJsonToYDoc(restored, json, 'unit-test');
    assert.equal(yDocToJson(restored), json);
  });
}

test('diff apply writes only local changed fields that differ from the live Y.Doc', () => {
  const [a] = peers();
  mutate(a, 'column:update', { colId: 'a', type: 'TEXT' });
  const table = getTablesMap(a).get('t')!;
  const body = (table.get('columnsById') as Y.Map<Y.Map<unknown>>)?.get('a');
  assert.ok(body);
  const keys: string[] = [];
  body.observe((event) => keys.push(...event.keysChanged));
  const diffs: DiffPlan['columns'] = [
    {
      entity: 'column',
      op: 'update',
      tableId: 't',
      columnId: 'a',
      current: {
        id: 'a',
        name: 'a',
        type: 'INT',
        nullable: true,
        logicalName: '논리 a',
        termId: 7,
      },
      next: {
        name: 'renamed',
        type: 'INT',
        nullable: true,
        pk: false,
        autoIncrement: false,
        logicalName: '논리 a',
        termId: 7,
      },
    },
  ];
  const plan: DiffPlan = {
    meta: { version: 'v1', createdAt: 0, fallbackRequired: false, fallbackReasons: [] },
    tables: [],
    columns: diffs,
    edges: [],
    summary: buildDiffPlanSummary({ tables: [], columns: diffs, edges: [] }),
  };
  const update = diffs[0]!;
  assert.equal(update.op, 'update');
  if (update.op !== 'update') return;
  assert.deepEqual(buildColumnFieldPatch(update.current, update.next, body), { name: 'renamed' });
  applyDiffToYDoc(a, plan);
  assert.deepEqual(buildColumnFieldPatch(update.current, update.next, body), {});
  assert.deepEqual(keys, ['name']);
  assert.equal(body.get('type'), 'TEXT');
  keys.length = 0;
  applyDiffToYDoc(a, plan);
  assert.deepEqual(keys, []);
});

test('moves use visible indices after repairing missing, duplicated and orphan order ids', () => {
  const [doc] = peers();
  const table = getTablesMap(doc).get('t')!;
  const order = table.get('columnOrder') as Y.Array<string>;
  doc.transact(() => {
    order.delete(0, order.length);
    order.push(['b', 'b', 'missing']);
  });
  assert.deepEqual(
    columns(doc).map((column) => column.id),
    ['b', 'a', 'c'],
  );
  const body = (table.get('columnsById') as Y.Map<Y.Map<unknown>>).get('b');
  mutate(doc, 'column:move', { fromIndex: 0, toIndex: 2 });
  assert.deepEqual(
    columns(doc).map((column) => column.id),
    ['a', 'c', 'b'],
  );
  assert.equal((table.get('columnsById') as Y.Map<Y.Map<unknown>>).get('b'), body);
});

test('first column edit uses a system migration transaction and undo preserves the schema', () => {
  const doc = legacyDoc();
  const table = getTablesMap(doc).get('t')!;
  const undo = new Y.UndoManager(getTablesMap(doc), {
    trackedOrigins: new Set(['canvas-user-column']),
  });
  const origins: unknown[] = [];
  const clientId = doc.clientID;
  doc.on('afterTransaction', (transaction: Y.Transaction) => origins.push(transaction.origin));
  mutate(doc, 'column:update', { colId: 'a', type: 'TEXT' });
  assert.deepEqual(origins, ['canvas-system-fallback', 'canvas-user-column']);
  assert.equal(doc.clientID, clientId);
  undo.undo();
  assert.ok(table.get('columnsById') instanceof Y.Map);
  assert.equal(columns(doc)[0]!.type, 'INT');
  undo.redo();
  assert.equal(columns(doc)[0]!.type, 'TEXT');
  undo.destroy();
});

test('independent minimal migrations emit identical bytes despite unrelated document edits', () => {
  const [a, b] = peers(false);
  // Different unrelated state must never enter the seed or its delete set.
  a.getMap('unrelated').set('value', 'local');
  b.getMap('unrelated').set('value', 'remote');
  b.getMap('unrelated').delete('value');
  const updates: Uint8Array[] = [];
  for (const doc of [a, b]) {
    doc.on('update', (update: Uint8Array) => updates.push(update));
    ensureColumnStorage(getTablesMap(doc).get('t')!);
  }
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[0], updates[1]);
  assert.equal(Y.decodeUpdate(updates[0]!).ds.clients.size, 0);
  mutate(a, 'column:move', { fromIndex: 0, toIndex: 2 });
  mutate(b, 'column:update', { colId: 'a', type: 'TEXT' });
  merge(a, b);
  assert.equal(columns(a).length, 3);
  assert.equal(columns(a)[2]!.type, 'TEXT');
});

test('migration rejects stale table references and removed schema instead of replaying clock zero', () => {
  const doc = legacyDoc();
  const table = getTablesMap(doc).get('t')!;
  getTablesMap(doc).set('t', new Y.Map());
  assert.throws(() => ensureColumnStorage(table), /requires an attached table/);
  const current = getTablesMap(doc).get('t')!;
  ensureColumnStorage(current);
  current.delete('columnsById');
  assert.throws(() => ensureColumnStorage(current), {
    code: 'ERR_COLUMN_STORAGE_INCONSISTENT',
  });
  doc.destroy();
});

test('reusing an empty legacy table key refuses an already used migration client clock', () => {
  const doc = new Y.Doc();
  const tables = getTablesMap(doc);
  const first = new Y.Map<unknown>();
  tables.set('empty', first);
  ensureColumnStorage(first);
  tables.delete('empty');
  const replacement = new Y.Map<unknown>();
  tables.set('empty', replacement);
  const before = Y.encodeStateAsUpdate(doc);
  assert.throws(() => ensureColumnStorage(replacement), {
    code: 'ERR_COLUMN_STORAGE_INCONSISTENT',
  });
  assert.deepEqual(Y.encodeStateAsUpdate(doc), before);
  doc.destroy();
});

for (const helper of ['move', 'delete'] as const) {
  test(`legacy ${helper} helper rejects nested migration and preserves remote edits after undo`, () => {
    const [a, b] = peers(false);
    const table = getTablesMap(a).get('t')!;
    const legacy = table.get('columns') as Y.Array<Y.Map<unknown>>;
    const clientIds = [a.clientID, b.clientID];
    const undo = new Y.UndoManager(getTablesMap(a), {
      trackedOrigins: new Set(['user']),
    });
    a.transact(() => {
      table.set('label', 'local label');
      assert.throws(
        () =>
          helper === 'move'
            ? moveColumnInYArray(legacy, 0, 2)
            : deleteColumnFromYArray(legacy, 'a'),
        { code: 'ERR_COLUMN_MIGRATION_IN_TRANSACTION' },
      );
    }, 'user');
    assert.equal(table.has('columnsById'), false);
    assert.deepEqual(
      legacy.toArray().map((body) => body.get('id')),
      ['a', 'b', 'c'],
    );
    merge(a, b);
    mutate(b, 'column:update', { colId: 'b', type: 'TEXT' });
    merge(a, b);
    undo.undo();
    merge(a, b);
    for (const doc of [a, b]) {
      assert.ok(getTablesMap(doc).get('t')!.get('columnsById') instanceof Y.Map);
      assert.equal(columns(doc)[1]!.type, 'TEXT');
      assert.equal(getTablesMap(doc).get('t')!.get('label'), 'items');
    }
    assert.deepEqual([a.clientID, b.clientID], clientIds);
    undo.destroy();
    a.destroy();
    b.destroy();
  });

  test(`legacy ${helper} helper permits prepared storage without including migration in undo`, () => {
    const [a, b] = peers();
    const table = getTablesMap(a).get('t')!;
    const legacy = table.get('columns') as Y.Array<Y.Map<unknown>>;
    const undo = new Y.UndoManager(getTablesMap(a), { trackedOrigins: new Set(['user']) });
    const bodies = table.get('columnsById');
    a.transact(() => {
      if (helper === 'move') moveColumnInYArray(legacy, 0, 2);
      else deleteColumnFromYArray(legacy, 'a');
    }, 'user');
    merge(a, b);
    mutate(b, 'column:update', { colId: 'b', type: 'TEXT' });
    merge(a, b);
    undo.undo();
    merge(a, b);
    assert.equal(table.get('columnsById'), bodies);
    assert.deepEqual(
      columns(a).map((column) => column.id),
      ['a', 'b', 'c'],
    );
    assert.equal(columns(a)[1]!.type, 'TEXT');
    undo.destroy();
    a.destroy();
    b.destroy();
  });
}

test('different field edits merge, and same field conflicts converge under Yjs LWW', () => {
  const [a, b] = peers(false);
  mutate(a, 'column:update', { colId: 'a', type: 'TEXT' });
  mutate(b, 'column:update', { colId: 'a', name: 'renamed' });
  merge(a, b);
  assert.equal(columns(a)[0]!.type, 'TEXT');
  assert.equal(columns(a)[0]!.name, 'renamed');
  mutate(a, 'column:update', { colId: 'a', type: 'FLOAT' });
  mutate(b, 'column:update', { colId: 'a', type: 'BIGINT' });
  merge(a, b);
  assert.ok(['FLOAT', 'BIGINT'].includes(columns(a)[0]!.type));
});

test('add, delete and subsequent move leave the legacy array unchanged', () => {
  const [a, b] = peers(false);
  const table = getTablesMap(a).get('t')!;
  const legacy = (table.get('columns') as Y.Array<Y.Map<unknown>>).toJSON();
  mutate(a, 'column:add', {});
  mutate(b, 'column:delete', { colId: 'b' });
  merge(a, b);
  assert.equal(columns(a).length, 3);
  const added = columns(a).find((column) => !['a', 'b', 'c'].includes(column.id))!;
  assert.ok(added);
  mutate(a, 'column:move', { fromIndex: 2, toIndex: 0 });
  merge(a, b);
  assert.equal(columns(a)[0]!.id, added.id);
  assert.deepEqual((table.get('columns') as Y.Array<Y.Map<unknown>>).toJSON(), legacy);
});

test('legacy helper exports resolve migrated bodies and never edit the legacy snapshot', () => {
  const [doc] = peers();
  const table = getTablesMap(doc).get('t')!;
  const legacy = table.get('columns') as Y.Array<Y.Map<unknown>>;
  mutate(doc, 'column:update', { colId: 'a', type: 'TEXT' });
  assert.equal(findColumnYMap(legacy, 'a')?.get('type'), 'TEXT');
  assert.equal(legacy.get(0).get('type'), 'INT');
});

test('migrated column field updates invalidate table and column scopes and queries read them', () => {
  const [doc] = peers();
  const scopes: Array<{ kind: string; id: string }> = [];
  doc.on('afterTransaction', (transaction: Y.Transaction) => {
    scopes.push(...collectErdAffectedScopesFromTransaction(doc, transaction));
  });
  mutate(doc, 'column:update', { colId: 'a', type: 'TEXT' });
  const columnId = buildErdColumnEntityId('t', 'a');
  assert.ok(scopes.some((scope) => scope.kind === 'table' && scope.id === 't'));
  assert.ok(scopes.some((scope) => scope.kind === 'column' && scope.id === columnId));
  const read = new ErdDocumentReadContextFactory({ getDocument: () => doc } as never, {
    getRevision: () => '1',
  }).create();
  assert.equal(read.getProperty({ kind: 'column', id: columnId }, 'type'), 'TEXT');
  mutate(doc, 'column:move', { fromIndex: 0, toIndex: 2 });
  assert.deepEqual(
    read.listRelated({ kind: 'table', id: 't' }, 'columns').map((ref) => ref.id),
    [buildErdColumnEntityId('t', 'b'), buildErdColumnEntityId('t', 'c'), columnId],
  );
  assert.equal(read.findByKind('column').length, 3);
  mutate(doc, 'column:delete', { colId: 'a' });
  assert.equal(read.getEntity({ kind: 'column', id: columnId }), null);
});

test('column projection helpers merge field edits with moves and document dictionary patches', () => {
  const [a, b] = peers(false);
  const actionsA = createCanvasTableActions((() => ({ ydoc: a })) as never);
  const actionsB = createCanvasTableActions((() => ({ ydoc: b })) as never);
  actionsA.moveColumn('t', 0, 2);
  actionsB.updateColumn('t', 'a', { type: 'TEXT' });
  merge(a, b);
  assert.deepEqual(
    columns(a).map((column) => column.id),
    ['b', 'c', 'a'],
  );
  assert.equal(columns(a)[2]!.type, 'TEXT');
  assert.equal(
    mutate(a, 'dictionary:reconcile', {
      plan: {
        tableMetaUpdates: [],
        columnUpdates: [{ nodeId: 't', colId: 'a', updates: { logicalName: '사전 이름' } }],
      },
    }),
    true,
  );
  merge(a, b);
  assert.equal(columns(b)[2]!.logicalName, '사전 이름');
});

/**
 * FK 트랜잭션 테스트의 레거시 부모 테이블을 추가한다.
 * @param doc 대상 문서
 * @returns 없음
 */
function addLegacyParent(doc: Y.Doc): void {
  const table = new Y.Map<unknown>();
  const legacy = new Y.Array<Y.Map<unknown>>();
  legacy.push([createColumnYMap({ id: 'p', name: 'p', type: 'INT', pk: true })]);
  table.set('label', 'parents');
  table.set('positionX', 300);
  table.set('positionY', 20);
  table.set('columns', legacy);
  getTablesMap(doc).set('parent', table);
}

/**
 * 테이블/엣지 연산만 있는 diff 계획을 만든다.
 * @param tables 테이블 연산
 * @param edges 엣지 연산
 * @returns diff 계획
 */
function relationPlan(tables: DiffPlan['tables'], edges: DiffPlan['edges']): DiffPlan {
  return {
    meta: { version: 'v1', createdAt: 0, fallbackRequired: false, fallbackReasons: [] },
    tables,
    columns: [],
    edges,
    summary: buildDiffPlanSummary({ tables, columns: [], edges }),
  };
}

test('diff prepares FK writes to renamed legacy tables outside the user transaction', () => {
  const doc = legacyDoc();
  addLegacyParent(doc);
  const table = getTablesMap(doc).get('t')!;
  (table.get('columns') as Y.Array<Y.Map<unknown>>).get(1).delete('fk');
  const origins: unknown[] = [];
  const clientId = doc.clientID;
  doc.on('afterTransaction', (transaction: Y.Transaction) => origins.push(transaction.origin));
  applyDiffToYDoc(
    doc,
    relationPlan(
      [
        {
          entity: 'table',
          op: 'update',
          tableId: 't',
          current: { id: 't', name: 'items', position: { x: 10, y: 20 }, columns: [] },
          next: { name: 'renamed', columns: [] },
          match: { strategy: 'exact-name', confidence: 'high', candidateCount: 1 },
        },
      ],
      [
        {
          entity: 'edge',
          op: 'add',
          relationType: 'non-identifying',
          next: {
            parentTable: 'parents',
            parentColumn: 'p',
            childTable: 'renamed',
            childColumn: 'a',
          },
        },
      ],
    ),
    'canvas-user-edge',
  );
  assert.equal(doc.clientID, clientId);
  assert.deepEqual(origins, ['canvas-system-fallback', 'canvas-user-edge']);
  assert.equal(
    findColumnYMap(table.get('columns') as Y.Array<Y.Map<unknown>>, 'a')?.get('fk'),
    true,
  );
});

test('diff table deletion prepares FK cleanup even without explicit edge deletes', () => {
  const doc = legacyDoc();
  addLegacyParent(doc);
  const edge = new Y.Map<unknown>([
    ['source', 'parent'],
    ['target', 't'],
    ['sourceHandle', 'parent-p-source'],
    ['targetHandle', 't-b-target'],
    ['relationType', 'non-identifying'],
  ]);
  doc.getMap('edges').set('relation', edge);
  const origins: unknown[] = [];
  const clientId = doc.clientID;
  doc.on('afterTransaction', (transaction: Y.Transaction) => origins.push(transaction.origin));
  applyDiffToYDoc(
    doc,
    relationPlan(
      [
        {
          entity: 'table',
          op: 'delete',
          tableId: 'parent',
          reason: 'missing-in-next',
          current: { id: 'parent', name: 'parents', position: { x: 300, y: 20 }, columns: [] },
        },
      ],
      [],
    ),
    'canvas-user-table',
  );
  assert.equal(doc.clientID, clientId);
  assert.deepEqual(origins, ['canvas-system-fallback', 'canvas-user-table']);
  assert.equal(doc.getMap('edges').size, 0);
  assert.equal(columns(doc).find((column) => column.id === 'b')?.fk, undefined);
});

test('diff emits no redundant flag deletion when the current Y.Doc already has false', () => {
  const [doc] = peers();
  mutate(doc, 'column:update', { colId: 'a', pk: false, autoIncrement: false });
  const live = findColumnYMap(
    getTablesMap(doc).get('t')!.get('columns') as Y.Array<Y.Map<unknown>>,
    'a',
  )!;
  const current = {
    id: 'a',
    name: 'a',
    type: 'INT',
    pk: true,
    autoIncrement: true,
    nullable: false,
  };
  const next = { name: 'a', type: 'INT', pk: false, autoIncrement: false, nullable: true };
  assert.deepEqual(buildColumnFieldPatch(current, next, live), {});
});
