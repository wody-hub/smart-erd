import { strict as assert } from 'node:assert';
import { test, type TestContext } from 'node:test';
import * as Y from 'yjs';
import { buildErdColumnEntityId } from '@/collaboration/plugins/erd/erd-column-entity-id';
import { ErdDocumentMutationApplier } from '@/collaboration/plugins/erd/erd-document-mutation-applier';
import { ErdDocumentPlugin } from '@/collaboration/plugins/erd/erd-document-plugin';
import { collectErdAffectedScopesFromEvents } from '@/collaboration/plugins/erd/erd-yjs-update-scope-collector';
import { ErdDocumentReadContextFactory } from '@/collaboration/plugins/erd/query/erd-document-read-context-factory';
import { readErdDocumentStructure } from '@/collaboration/plugins/erd/query/erd-document-graph-query';
import type { DocumentReadExecutor } from '@/collaboration/core/contracts/document-read-executor';
import { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';
import { ensureColumnStorage, readColumnYMaps } from '@/collaboration/yjs-columns';
import {
  getTablesMap,
  migrateJsonToYDoc,
  yDocToJson,
  yTablesMapToNodes,
} from '@/collaboration/yjsBridge';
import type { Column } from '@/types/erd';
import { generateDdl } from '@/lib/ddl-generator';
import { generateDsl } from '@/lib/dsl-generator';
import { serializeDiagramDefinitionExportContent } from '@/lib/diagram-definition-export';

// Hand-authored previous-version backup: missing optional fields must stay missing,
// while explicit false flags and dictionary references must survive every boundary.
const backup = {
  nodes: [
    {
      id: 't',
      type: 'table',
      position: { x: 10, y: 20 },
      data: {
        label: 'items',
        columns: [
          { id: 'a', name: 'id', type: 'INT' },
          {
            id: 'b',
            name: 'owner_id',
            type: 'BIGINT',
            pk: true,
            fk: true,
            nullable: false,
            autoIncrement: false,
            logicalName: '소유자',
            termId: 7,
            domainId: 12,
          },
          { id: 'c', name: 'note', type: 'TEXT', nullable: true },
        ],
      },
    },
  ],
  edges: [],
  groups: [],
};

/**
 * 테스트 종료 시 문서와 내부 Yjs 자원을 해제한다.
 * @param context 테스트 수명
 * @param gc GC 활성 여부
 * @returns 실제 Yjs 문서
 */
function document(context: TestContext, gc = true): Y.Doc {
  const doc = new Y.Doc({ gc });
  context.after(() => doc.destroy());
  return doc;
}

/**
 * bootstrap 생성기에 의존하지 않고 이전 버전의 Y.Doc을 구성한다.
 * @param context 테스트 수명
 * @param gc GC 활성 여부
 * @returns 레거시 배열만 있는 문서
 */
function legacyDocument(context: TestContext, gc = true): Y.Doc {
  const doc = document(context, gc);
  const table = new Y.Map<unknown>();
  const columns = new Y.Array<Y.Map<unknown>>();
  columns.push(backup.nodes[0]!.data.columns.map((column) => new Y.Map(Object.entries(column))));
  table.set('label', 'items');
  table.set('positionX', 10);
  table.set('positionY', 20);
  table.set('columns', columns);
  getTablesMap(doc).set('t', table);
  return doc;
}

/**
 * 저장된 full-state update로 독립 클라이언트를 연다.
 * @param context 테스트 수명
 * @param snapshot 서버가 저장한 opaque update
 * @param gc GC 활성 여부
 * @returns 복구된 문서
 */
function load(context: TestContext, snapshot: Uint8Array, gc = true): Y.Doc {
  const doc = document(context, gc);
  Y.applyUpdate(doc, snapshot);
  return doc;
}

/**
 * 사용자 편집과 동일한 플러그인 경로로 mutation을 실행한다.
 * @param doc 대상 문서
 * @param key mutation 키
 * @param payload mutation 필드
 * @returns 없음
 */
function mutate(doc: Y.Doc, key: string, payload: Record<string, unknown>): void {
  const result = new ErdDocumentMutationApplier({ getDocument: () => doc } as never).apply({
    key,
    payload: { tableId: 't', ...payload },
    affectedScopes: [],
  });
  assert.equal(result.applied, true);
}

/**
 * JSON 직렬화 경계에서 컬럼 필드와 순서를 조회한다.
 * @param doc 대상 문서
 * @returns plain columns 배열
 */
function columns(doc: Y.Doc): Column[] {
  return JSON.parse(yDocToJson(doc)).nodes[0].data.columns;
}

/**
 * 모든 피어의 변경을 중복 및 역순 전달하고 수렴 결과를 확인한다.
 * @param docs 독립 클라이언트
 * @param expected 기대하는 컬럼 필드와 순서
 * @returns 없음
 */
function synchronize(docs: Y.Doc[], expected: Column[]): void {
  const updates = docs.map((doc) => Y.encodeStateAsUpdate(doc));
  for (const doc of docs) {
    for (const update of [...updates].reverse().concat(updates)) Y.applyUpdate(doc, update);
    assert.deepEqual(columns(doc), expected);
    assert.equal(yDocToJson(doc), yDocToJson(docs[0]!));
  }
}

test('legacy server snapshot plus reordered duplicated incremental updates restores identical JSON', (context) => {
  const snapshot = Y.encodeStateAsUpdate(legacyDocument(context));
  const editor = load(context, snapshot);
  assert.equal(getTablesMap(editor).get('t')!.has('columnsById'), false);
  const updates: Uint8Array[] = [];
  editor.on('update', (update: Uint8Array) => updates.push(update));
  mutate(editor, 'column:update', { colId: 'a', type: 'BIGINT' });
  mutate(editor, 'column:move', { fromIndex: 0, toIndex: 2 });
  mutate(editor, 'column:update', { colId: 'b', logicalName: '변경' });
  assert.ok(updates.length >= 4, 'migration and user edits must be separate updates');
  const expected = [
    { ...backup.nodes[0]!.data.columns[1]!, logicalName: '변경' },
    backup.nodes[0]!.data.columns[2]!,
    { id: 'a', name: 'id', type: 'BIGINT' },
  ];
  const messages = [snapshot, ...updates];
  for (const delivery of [
    messages,
    [...messages].reverse(),
    [...updates].reverse().concat([snapshot], updates, [snapshot]),
  ]) {
    const restored = document(context);
    for (const update of delivery) Y.applyUpdate(restored, update);
    assert.deepEqual(columns(restored), expected);
    assert.equal(yDocToJson(restored), yDocToJson(editor));
  }
});

for (const gc of [true, false]) {
  test(`migrated full-state compaction and repeated rebuild preserve edits and order (gc=${gc})`, (context) => {
    const editor = load(context, Y.encodeStateAsUpdate(legacyDocument(context, gc)), gc);
    mutate(editor, 'column:update', { colId: 'b', type: 'VARCHAR(80)' });
    mutate(editor, 'column:update', { colId: 'b', type: 'VARCHAR(120)' });
    mutate(editor, 'column:move', { fromIndex: 0, toIndex: 2 });
    mutate(editor, 'column:delete', { colId: 'c' });
    const expected = [
      { ...backup.nodes[0]!.data.columns[1]!, type: 'VARCHAR(120)' },
      { id: 'a', name: 'id', type: 'INT' },
    ];
    for (const restoreGc of [true, false]) {
      const compacted = Y.encodeStateAsUpdate(editor);
      const restored = load(context, compacted, restoreGc);
      const rebuilt = load(context, Y.encodeStateAsUpdate(restored), restoreGc);
      for (const doc of [editor, restored, rebuilt]) {
        assert.deepEqual(columns(doc), expected);
        assert.equal(yDocToJson(doc), yDocToJson(editor));
      }
      // A rebuilt/GC'ed seed must also remain editable and merge with its source.
      mutate(rebuilt, 'column:update', { colId: 'a', logicalName: '복구 후' });
      synchronize([restored, rebuilt], [expected[0]!, { ...expected[1]!, logicalName: '복구 후' }]);
    }
  });
}

test('offline first migration and online edits of the same legacy table survive reconnect', (context) => {
  const snapshot = Y.encodeStateAsUpdate(legacyDocument(context));
  const offline = load(context, snapshot);
  const online = load(context, snapshot);
  mutate(offline, 'column:move', { fromIndex: 0, toIndex: 2 });
  mutate(offline, 'column:update', { colId: 'a', type: 'BIGINT' });
  mutate(online, 'column:update', { colId: 'a', logicalName: '온라인' });
  mutate(online, 'column:update', { colId: 'b', type: 'UUID' });
  synchronize(
    [offline, online],
    [
      { ...backup.nodes[0]!.data.columns[1]!, type: 'UUID' },
      backup.nodes[0]!.data.columns[2]!,
      { id: 'a', name: 'id', type: 'BIGINT', logicalName: '온라인' },
    ],
  );
});

test('two concurrent migrators plus a third field editor retain all three clients changes', (context) => {
  const snapshot = Y.encodeStateAsUpdate(legacyDocument(context));
  const a = load(context, snapshot);
  const b = load(context, snapshot);
  const c = load(context, snapshot);
  ensureColumnStorage(getTablesMap(a).get('t')!);
  ensureColumnStorage(getTablesMap(b).get('t')!);
  mutate(a, 'column:move', { fromIndex: 0, toIndex: 2 });
  mutate(b, 'column:update', { colId: 'b', logicalName: '둘째' });
  mutate(c, 'column:update', { colId: 'a', type: 'BIGINT' });
  synchronize(
    [a, b, c],
    [
      { ...backup.nodes[0]!.data.columns[1]!, logicalName: '둘째' },
      backup.nodes[0]!.data.columns[2]!,
      { id: 'a', name: 'id', type: 'BIGINT' },
    ],
  );
});

test('legacy and migrated JSON keep the previous plain columns backup contract', (context) => {
  const doc = legacyDocument(context);
  const before = yDocToJson(doc);
  assert.deepEqual(columns(doc), backup.nodes[0]!.data.columns);
  ensureColumnStorage(getTablesMap(doc).get('t')!);
  assert.equal(yDocToJson(doc), before);
  assert.deepEqual(columns(doc), backup.nodes[0]!.data.columns);
});

for (const source of ['previous-version', 'legacy', 'migrated'] as const) {
  test(`JSON reseed creates only new column storage and preserves optional fields (${source})`, (context) => {
    const original = legacyDocument(context);
    if (source === 'migrated') {
      mutate(original, 'column:move', { fromIndex: 0, toIndex: 2 });
      mutate(original, 'column:update', { colId: 'a', type: 'BIGINT' });
    }
    const json = source === 'previous-version' ? JSON.stringify(backup) : yDocToJson(original);
    const restored = document(context);
    migrateJsonToYDoc(restored, json, 'test-bootstrap');
    const table = getTablesMap(restored).get('t')!;
    assert.ok(table.get('columnsById') instanceof Y.Map);
    assert.ok(table.get('columnOrder') instanceof Y.Array);
    assert.equal(table.has('columns'), false, 'reseed must not create a stale legacy replica');
    assert.deepEqual(columns(restored), columns(original));
    if (source !== 'previous-version') assert.equal(yDocToJson(restored), json);
    const reloaded = load(context, Y.encodeStateAsUpdate(restored));
    assert.deepEqual(columns(reloaded), columns(original));
  });
}

test('JSON reseed preserves explicit false flags and empty optional column values', (context) => {
  const expected = {
    id: 'a',
    name: 'id',
    type: 'INT',
    pk: false,
    fk: false,
    autoIncrement: false,
    nullable: false,
    logicalName: '',
    termId: 0,
    domainId: 0,
  };
  const json = {
    ...backup,
    nodes: [{ ...backup.nodes[0]!, data: { label: 'items', columns: [expected] } }],
  };
  const doc = document(context);
  migrateJsonToYDoc(doc, JSON.stringify(json), 'test-bootstrap');
  assert.deepEqual(columns(doc), [expected]);
});

test('bootstrap adapter and compatibility artifact preserve the JSON backup columns', (context) => {
  const adapter = new DiagramYjsDocumentAdapter();
  const doc = document(context);
  adapter.applyBootstrapToDoc(
    doc,
    {
      content: JSON.stringify(backup),
      hasYdocSnapshot: false,
      contentRevision: '1',
    },
    'bootstrap',
  );
  assert.equal(getTablesMap(doc).get('t')!.has('columns'), false);
  assert.deepEqual(columns(doc), backup.nodes[0]!.data.columns);
  mutate(doc, 'column:move', { fromIndex: 0, toIndex: 2 });
  mutate(doc, 'column:update', { colId: 'a', type: 'BIGINT' });
  const artifact = new ErdDocumentPlugin()
    .createArtifactSerializer({} as never)
    .build(adapter.extractFullStateUpdate(doc));
  assert.ok(artifact);
  const restored = document(context);
  adapter.applyBootstrapToDoc(
    restored,
    {
      content: new TextDecoder().decode(artifact),
      hasYdocSnapshot: false,
      contentRevision: '2',
    },
    'bootstrap',
  );
  assert.equal(getTablesMap(restored).get('t')!.has('columns'), false);
  assert.equal(yDocToJson(restored), yDocToJson(doc));
});

test('legacy writers update only the stale array after migration and new-only tables have no legacy columns', (context) => {
  const current = legacyDocument(context);
  const legacy = load(context, Y.encodeStateAsUpdate(current));
  mutate(current, 'column:update', { colId: 'a', type: 'BIGINT' });
  Y.applyUpdate(legacy, Y.encodeStateAsUpdate(current));
  const stale = getTablesMap(legacy).get('t')!.get('columns') as Y.Array<Y.Map<unknown>>;
  assert.equal(stale.get(0).get('type'), 'INT');
  stale.get(0).set('name', 'legacy_rename');
  Y.applyUpdate(current, Y.encodeStateAsUpdate(legacy));
  assert.deepEqual(columns(current)[0], { id: 'a', name: 'id', type: 'BIGINT' });
  assert.equal(
    (getTablesMap(current).get('t')!.get('columns') as Y.Array<Y.Map<unknown>>).get(0).get('name'),
    'legacy_rename',
  );
  const reseeded = document(context);
  migrateJsonToYDoc(reseeded, yDocToJson(current), 'bootstrap');
  assert.equal(getTablesMap(reseeded).get('t')!.get('columns'), undefined);
});

test('document query feeds DSL DDL and definition exports with current new-only column order', (context) => {
  const doc = document(context);
  migrateJsonToYDoc(doc, JSON.stringify(backup), 'bootstrap');
  mutate(doc, 'column:move', { fromIndex: 0, toIndex: 2 });
  mutate(doc, 'column:update', { colId: 'a', name: 'new_id', type: 'BIGINT' });
  const factory = new ErdDocumentReadContextFactory({ getDocument: () => doc } as never, {
    getRevision: () => '1',
  });
  const executor: DocumentReadExecutor = {
    getRevision: () => '1',
    execute: (query) => query.run(factory.create()),
    exportSnapshot: () => Y.encodeStateAsUpdate(doc),
  };
  const { nodes, edges } = readErdDocumentStructure(executor);
  assert.equal(getTablesMap(doc).get('t')!.has('columns'), false);
  assert.deepEqual(
    nodes[0]!.data.columns.map((column) => column.id),
    ['b', 'c', 'a'],
  );
  const dsl = generateDsl(nodes, edges, {
    findTermById: () => undefined,
    findDomainById: () => undefined,
  });
  assert.ok(dsl.includes('소유자'));
  assert.ok(dsl.indexOf('소유자') < dsl.indexOf('note'));
  assert.ok(dsl.indexOf('note') < dsl.indexOf('new_id'));
  const ddl = generateDdl(nodes, edges, 'postgresql');
  assert.match(ddl, /new_id.*BIGINT/);
  assert.ok(ddl.includes('owner_id'));
  assert.ok(ddl.indexOf('owner_id') < ddl.indexOf('note'));
  assert.ok(ddl.indexOf('note') < ddl.indexOf('new_id'));
  const exported = JSON.parse(serializeDiagramDefinitionExportContent(nodes, edges));
  assert.deepEqual(exported.nodes[0].data.columns, columns(doc));
});

test('remote new-storage-only updates notify table scopes and project current columns', (context) => {
  const doc = document(context);
  migrateJsonToYDoc(doc, JSON.stringify(backup), 'test-bootstrap');
  const remote = load(context, Y.encodeStateAsUpdate(doc));
  assert.equal(getTablesMap(doc).get('t')!.has('columns'), false);
  const read = new ErdDocumentReadContextFactory({ getDocument: () => doc } as never, {
    getRevision: () => '1',
  }).create();
  const scopes: string[] = [];
  getTablesMap(doc).observeDeep((events) => {
    scopes.push(
      ...collectErdAffectedScopesFromEvents(doc, events).map(
        (scope) => `${scope.kind}:${scope.id}`,
      ),
    );
  });
  mutate(remote, 'column:update', { colId: 'a', type: 'BIGINT' });
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote));
  const id = buildErdColumnEntityId('t', 'a');
  assert.ok(scopes.includes('table:t'));
  assert.ok(scopes.includes(`column:${id}`));
  assert.equal(read.getProperty({ kind: 'column', id }, 'type'), 'BIGINT');
  assert.equal(read.findByKind('column').length, 3);
  assert.equal(read.listRelated({ kind: 'table', id: 't' }, 'columns').length, 3);
  assert.equal(yTablesMapToNodes(getTablesMap(doc))[0]!.data.columns[0]!.type, 'BIGINT');
  scopes.length = 0;
  mutate(remote, 'column:move', { fromIndex: 0, toIndex: 2 });
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote));
  assert.ok(scopes.includes('table:t'));
  assert.deepEqual(
    read.listRelated({ kind: 'table', id: 't' }, 'columns').map((ref) => ref.id),
    [buildErdColumnEntityId('t', 'b'), buildErdColumnEntityId('t', 'c'), id],
  );
  assert.deepEqual(
    readColumnYMaps(getTablesMap(doc).get('t')!).map((body) => body.get('id')),
    ['b', 'c', 'a'],
  );
});
