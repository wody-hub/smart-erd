import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import { DocumentStore } from '../../src/collaboration/core/store/document-store.js';
import { DocumentRevisionTracker } from '../../src/collaboration/core/store/document-revision-tracker.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { ErdDocumentReadContextFactory } from '../../src/collaboration/plugins/erd/query/erd-document-read-context-factory.js';
import { collectErdAffectedScopes } from '../../src/collaboration/plugins/erd/erd-yjs-update-scope-collector.js';
import {
  ErdCodeProjectionPort,
  applyErdCodeProjectionBatch,
  type ProjectionDictionaryVersion,
  type TextPatchBatch,
} from '../../src/collaboration/plugins/erd/erd-code-projection-port.js';
import {
  createColumnYMap,
  createTableYMap,
  createEdgeYMap,
  getTablesMap,
  getEdgesMap,
  yTablesMapToNodes,
  yEdgesMapToEdges,
} from '../../src/collaboration/yjsBridge.js';
import { getColumnYMap } from '../../src/collaboration/yjs-columns.js';
import { generateProjection } from '../../src/lib/dsl-block-projection.js';
import { createTrackedCanvasHistoryOrigins } from '../../src/constants/canvas-history.js';

/** 실제 문서·스토어·변경 적용기로 투영 계약을 검사한다. */
function harness(doc = new Y.Doc()) {
  const tables = getTablesMap(doc);
  const edges = getEdgesMap(doc);
  const engine = new YjsSharedDocumentEngine(doc);
  const revisions = new DocumentRevisionTracker();
  const store = new DocumentStore(
    new ErdDocumentMutationApplier(engine),
    revisions,
    new ErdDocumentReadContextFactory(engine, revisions),
    () => engine.exportSnapshot(),
    (update) => collectErdAffectedScopes(engine, update),
  );
  store.attach();
  const unsubscribe = engine.subscribeUpdates((update) => revisions.handleDocumentUpdated(update));
  let dictionary: ProjectionDictionaryVersion = {
    version: '1',
    fingerprint: 'empty',
    dictionary: { terms: [], domains: [] },
  };
  let epoch = 'first';
  const port = new ErdCodeProjectionPort({
    read: store,
    getDocument: () => doc,
    getEpoch: () => epoch,
    dictionary,
  });
  const batches: TextPatchBatch[] = [];
  let consumer = { text: '', revision: 0 };
  port.subscribe((batch) => {
    batches.push(batch);
    consumer = applyErdCodeProjectionBatch(consumer, batch);
  });
  /** 기존 전체 읽기·생성을 독립 기준으로 사용한다. */
  function check() {
    const before = Y.encodeStateAsUpdate(doc);
    port.flush();
    const full = generateProjection({
      revision: 0,
      nodes: yTablesMapToNodes(tables),
      edges: yEdgesMapToEdges(edges),
      dictionary: dictionary.dictionary,
    });
    assert.equal(consumer.text, full.text);
    assert.deepEqual(batches.at(-1)!.blockMetadata, full.blocks);
    assert.deepEqual(Y.encodeStateAsUpdate(doc), before);
  }
  /** 실제 mutation을 스토어에 전달한다. */
  function mutate(
    key: string,
    payload: Record<string, unknown>,
    scopes: { kind: string; id: string; mode: 'shared' }[] = [],
  ) {
    assert.equal(
      store.applyMutation({ key, payload, affectedScopes: scopes }, { origin: { source: 'local' } })
        .applied,
      true,
    );
  }
  return {
    doc,
    tables,
    edges,
    engine,
    store,
    port,
    batches,
    check,
    mutate,
    consumer: () => consumer,
    setEpoch: (next: string) => {
      epoch = next;
    },
    dictionary: (next: ProjectionDictionaryVersion) => {
      dictionary = next;
      port.setDictionary(next);
    },
    dispose: () => {
      port.dispose();
      unsubscribe();
      store.dispose();
      doc.destroy();
    },
  };
}

/** 부모·자식 참조를 가진 고정 데이터를 만든다. */
function seed(h: ReturnType<typeof harness>) {
  for (const id of ['a', 'b', 'c'])
    h.tables.set(
      id,
      createTableYMap(id, { x: 0, y: 0 }, [
        { id: 'id', name: 'id', type: 'INT', pk: true },
        { id: 'value', name: 'value', type: 'VARCHAR(20)', termId: 1, domainId: 2 },
      ]),
    );
  h.edges.set('ab', createEdgeYMap('a', 'b', 'a-id-source', 'b-value-target'));
}

test('explicit hydration reads bootstrap after subscription without document updates', () => {
  const h = harness();
  const remote = new Y.Doc();
  getTablesMap(remote).set('remote', createTableYMap('수화', { x: 1, y: 2 }, []));
  h.engine.hydrate(Y.encodeStateAsUpdate(remote));
  assert.equal(h.batches.length, 0);
  let updates = 0;
  h.doc.on('update', () => updates++);
  h.port.hydrate();
  h.check();
  assert.match(h.consumer().text, /수화/);
  assert.equal(updates, 0);
  assert.equal(h.batches[0].baseRevision, 0);
  assert.equal(h.batches[0].nextRevision, 1);
  h.dispose();
  remote.destroy();
});

test('parent rename, changed endpoints and deleted FK refresh dependent blocks', () => {
  const h = harness();
  seed(h);
  h.port.hydrate();
  h.mutate('table:rename', { tableId: 'a', label: '부모😀' }, [
    { kind: 'table', id: 'a', mode: 'shared' },
  ]);
  h.check();
  assert.match(h.consumer().text, /부모😀\.id/);
  h.mutate('column:update', { tableId: 'a', colId: 'id', name: '번호' });
  h.check();
  assert.match(h.consumer().text, /부모😀\.번호/);
  h.edges.get('ab')!.set('target', 'c');
  h.edges.get('ab')!.set('targetHandle', 'c-value-target');
  h.check();
  assert.deepEqual(h.batches.at(-1)!.invalidatedTableIds, ['a', 'b', 'c']);
  h.mutate('edge:delete', { edgeId: 'ab' }, [{ kind: 'edge', id: 'ab', mode: 'shared' }]);
  h.check();
  assert.deepEqual(h.batches.at(-1)!.invalidatedTableIds, ['a', 'c']);
  assert.equal(
    h.batches.at(-1)!.blockMetadata.find((b) => b.tableId === 'c')!.metadata.relations.length,
    0,
  );
  h.dispose();
});

test('same tick changes coalesce; dispose cancels scheduled delivery', async () => {
  const h = harness();
  seed(h);
  h.port.hydrate();
  const count = h.batches.length;
  h.mutate('table:rename', { tableId: 'a', label: 'first' });
  h.mutate('column:update', { tableId: 'b', colId: 'value', name: 'second' });
  assert.equal(h.batches.length, count);
  await Promise.resolve();
  assert.equal(h.batches.length, count + 1);
  h.check();
  h.tables.get('a')!.set('label', 'disposed');
  h.port.dispose();
  await Promise.resolve();
  assert.equal(h.batches.length, count + 1);
  h.dispose();
});

test('stale batches reject and a missed batch resyncs from consumer text', () => {
  const h = harness();
  seed(h);
  h.port.hydrate();
  const stale = h.consumer();
  h.mutate('table:rename', { tableId: 'a', label: 'new' });
  h.check();
  assert.throws(() => applyErdCodeProjectionBatch(stale, h.batches[0]), /revision/i);
  const last = h.batches.at(-1)!.nextRevision;
  const batch = h.port.resync(stale)!;
  assert.equal(batch.fullResync, true);
  assert.equal(batch.baseRevision, stale.revision);
  assert.ok(batch.nextRevision > last);
  assert.equal(applyErdCodeProjectionBatch(stale, batch).text, h.consumer().text);
  h.dispose();
});

test('dictionary version/fingerprint changes invalidate users and FK dependencies', () => {
  const h = harness();
  seed(h);
  h.tables.get('c')!.set('tableTermId', 3);
  getColumnYMap(h.tables.get('c')!, 'value')!.delete('domainId');
  getColumnYMap(h.tables.get('c')!, 'value')!.delete('termId');
  h.port.hydrate();
  h.dictionary({
    version: '2',
    fingerprint: 'domain-2',
    dictionary: {
      terms: [{ id: 1, logicalName: '용어', domainId: 2 }],
      domains: [{ id: 2, logicalName: '숫자', dataType: 'BIGINT' }],
    },
  });
  h.check();
  assert.deepEqual(h.batches.at(-1)!.invalidatedTableIds, ['a', 'b']);
  assert.equal(h.batches.at(-1)!.dictionaryVersion, '2');
  assert.equal(h.batches.at(-1)!.dictionaryFingerprint, 'domain-2');
  h.dictionary({
    version: '2',
    fingerprint: 'term-3',
    dictionary: { terms: [{ id: 3, logicalName: '새 용어' }], domains: [] },
  });
  h.check();
  assert.ok(h.batches.at(-1)!.invalidatedTableIds.includes('c'));
  h.dispose();
});

for (const position of ['object', 'ymap'])
  test(`legacy columns and ${position} coordinates stay read-only`, () => {
    const h = harness();
    const table = new Y.Map<unknown>();
    const columns = new Y.Array<Y.Map<unknown>>();
    columns.push([createColumnYMap({ id: 'legacy', name: '레거시', type: 'INT' })]);
    table.set('label', 'old');
    table.set('columns', columns);
    table.set(
      'position',
      position === 'ymap' ? new Y.Map(Object.entries({ x: 3, y: 4 })) : { x: 3, y: 4 },
    );
    h.tables.set('old', table);
    let updates = 0;
    h.doc.on('update', () => updates++);
    h.port.hydrate();
    h.check();
    h.port.resync();
    h.check();
    assert.equal(updates, 0);
    assert.equal(table.has('columnsById'), false);
    columns.get(0).set('name', '갱신');
    h.check();
    assert.equal(updates, 1);
    h.dispose();
  });

test('unknown scope, reconnect and epoch changes revalidate with minimal patches', () => {
  const h = harness();
  seed(h);
  h.port.hydrate();
  h.mutate('table:rename', { tableId: 'a', label: 'unknown' }, [
    { kind: 'unknown', id: '*', mode: 'shared' },
  ]);
  h.check();
  assert.equal(h.batches.at(-1)!.fullRevalidation, true);
  h.setEpoch('second');
  h.port.flush();
  h.check();
  assert.equal(h.batches.at(-1)!.fullRevalidation, true);
  assert.deepEqual(h.batches.at(-1)!.patches, []);
  h.port.resync();
  h.check();
  assert.deepEqual(h.batches.at(-1)!.patches, []);
  h.dispose();
});

for (const randomSeed of [7, 42, 2026])
  test(`randomized real mutations/undo/redo/remote merge remain equal to full generation (seed ${randomSeed})`, () => {
    const h = harness();
    seed(h);
    h.port.hydrate();
    const undo = new Y.UndoManager([h.tables, h.edges], {
      trackedOrigins: createTrackedCanvasHistoryOrigins(),
      captureTimeout: 0,
    });
    let randomState = randomSeed;
    /** 재현 가능한 난수를 반환한다. */
    function random(max: number) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState % max;
    }
    const counts = new Set<number>();
    for (let step = 0; step < 180; step++) {
      const ids = [...h.tables.keys()];
      const tableId = ids[random(ids.length)];
      const table = h.tables.get(tableId)!;
      const columns = table.get('columnOrder') as Y.Array<string>;
      const colId = columns.get(random(columns.length));
      const action = step < 12 ? step : random(12);
      counts.add(action);
      const scope = [{ kind: 'table', id: tableId, mode: 'shared' as const }];
      switch (action) {
        case 0:
          h.mutate('table:rename', { tableId, label: `이름_${step}😀` }, scope);
          break;
        case 1:
          if (colId)
            h.mutate(
              'column:update',
              { tableId, colId, name: `컬럼_${step}`, logicalName: `논리_${step}` },
              scope,
            );
          break;
        case 2:
          if (columns.length > 1)
            h.mutate('column:move', { tableId, fromIndex: 0, toIndex: columns.length - 1 }, scope);
          break;
        case 3:
          h.mutate('column:add', { tableId }, scope);
          break;
        case 4:
          if (columns.length > 1) h.mutate('column:delete', { tableId, colId }, scope);
          break;
        case 5:
          h.mutate('table:add', { tableId: `new_${step}`, name: `new_${step}` });
          break;
        case 6:
          if (ids.length > 2) h.mutate('table:delete', { tableId }, scope);
          break;
        case 7: {
          const targetTableId = ids[(ids.indexOf(tableId) + 1) % ids.length];
          const targetColumn = (
            h.tables.get(targetTableId)!.get('columnOrder') as Y.Array<string>
          ).get(0);
          if (colId && targetColumn)
            h.mutate('edge:connect', {
              edgeId: `fk_${step}`,
              sourceTableId: tableId,
              targetTableId,
              sourceHandle: `${tableId}-${colId}-source`,
              targetHandle: `${targetTableId}-${targetColumn}-target`,
              relationType: 'non-identifying',
            });
          break;
        }
        case 8: {
          const edgeId = [...h.edges.keys()][0];
          if (edgeId)
            h.mutate('edge:delete', { edgeId }, [{ kind: 'edge', id: edgeId, mode: 'shared' }]);
          break;
        }
        case 9:
          h.dictionary({
            version: step,
            fingerprint: `dictionary_${step}`,
            dictionary: {
              terms: [{ id: 1, logicalName: `용어_${step}`, domainId: 2 }],
              domains: [
                { id: 2, logicalName: `도메인_${step}`, dataType: step % 2 ? 'BIGINT' : 'INT' },
              ],
            },
          });
          break;
        case 10:
          undo.undo();
          h.check();
          undo.redo();
          break;
        case 11: {
          const remote = new Y.Doc();
          Y.applyUpdate(remote, Y.encodeStateAsUpdate(h.doc));
          getTablesMap(remote).get(tableId)!.set('logicalTableName', `원격_${step}`);
          const remoteColumn = colId && getColumnYMap(getTablesMap(remote).get(tableId)!, colId);
          if (remoteColumn) remoteColumn.set('logicalName', `원격컬럼_${step}`);
          // 동시에 생긴 로컬 변경과 원격 상태를 합친다.
          h.mutate('table:rename', { tableId, label: `동시_${step}` }, scope);
          h.engine.applyRemoteDelta(Y.encodeStateAsUpdate(remote));
          remote.destroy();
          break;
        }
      }
      h.check();
    }
    assert.equal(counts.size, 12);
    undo.destroy();
    h.dispose();
  });

test('scoped column-only events reuse unrelated node data and read in one execute', async () => {
  const { readErdCodeProjectionSnapshot } =
    await import('../../src/collaboration/plugins/erd/erd-code-projection-snapshot.js');
  const { buildErdColumnEntityId } =
    await import('../../src/collaboration/plugins/erd/erd-column-entity-id.js');
  const h = harness();
  seed(h);
  let reads = 0;
  const read = {
    execute: <T>(query: Parameters<typeof h.store.execute<T>>[0]) => {
      reads++;
      return h.store.execute(query);
    },
  };
  const first = readErdCodeProjectionSnapshot(
    read,
    () => h.doc,
    { terms: [], domains: [] },
    1,
  ).snapshot;
  getColumnYMap(h.tables.get('a')!, 'id')!.set('name', 'new');
  const next = readErdCodeProjectionSnapshot(read, () => h.doc, first.dictionary, 2, first, [
    { kind: 'column', id: buildErdColumnEntityId('a', 'id'), mode: 'shared' },
  ]).snapshot;
  assert.equal(reads, 2);
  assert.equal(
    next.nodes.find((n) => n.id === 'c'),
    first.nodes.find((n) => n.id === 'c'),
  );
  assert.equal(next.nodes.find((n) => n.id === 'a')!.data.columns[0].name, 'new');
  h.dispose();
});

test('edge-only scopes also reread FK column flags on both endpoints', () => {
  const h = harness();
  seed(h);
  h.edges.clear();
  h.port.hydrate();
  h.mutate(
    'edge:connect',
    {
      edgeId: 'edge-only',
      sourceTableId: 'a',
      targetTableId: 'b',
      sourceHandle: 'a-id-source',
      targetHandle: 'b-value-target',
      relationType: 'non-identifying',
    },
    [{ kind: 'edge', id: 'edge-only', mode: 'shared' }],
  );
  h.check();
  assert.equal(
    h.batches
      .at(-1)!
      .blockMetadata.find((b) => b.tableId === 'b')!
      .metadata.columns.find((c) => c.id === 'value')!.fk,
    true,
  );
  h.dispose();
});

test('document replacement resets the snapshot cache but preserves projection revision', () => {
  const first = harness();
  seed(first);
  const second = harness();
  second.tables.set('replacement', createTableYMap('다른 문서', { x: 8, y: 9 }, []));
  let active = first;
  const port = new ErdCodeProjectionPort({
    read: {
      execute: <T>(query: Parameters<typeof first.store.execute<T>>[0]) =>
        active.store.execute(query),
      getRevision: () => active.store.getRevision(),
      subscribe: (listener) => {
        const off1 = first.store.subscribe(listener);
        const off2 = second.store.subscribe(listener);
        return () => {
          off1();
          off2();
        };
      },
    },
    getDocument: () => active.doc,
    dictionary: { version: 1, fingerprint: 'empty', dictionary: { terms: [], domains: [] } },
  });
  let state = { text: '', revision: 0 };
  port.subscribe((batch) => {
    state = applyErdCodeProjectionBatch(state, batch);
  });
  port.hydrate();
  const revision = state.revision;
  active = second;
  const batch = port.flush()!;
  assert.equal(batch.fullRevalidation, true);
  assert.ok(state.revision > revision);
  assert.match(state.text, /다른 문서/);
  assert.doesNotMatch(state.text, /value/);
  port.dispose();
  first.dispose();
  second.dispose();
});

test('dictionary changes during synchronous read discard stale computation', async () => {
  const h = harness();
  seed(h);
  let changeDictionary = false;
  const port = new ErdCodeProjectionPort({
    read: {
      execute: <T>(query: Parameters<typeof h.store.execute<T>>[0]) => {
        const result = h.store.execute(query);
        if (changeDictionary) {
          changeDictionary = false;
          port.setDictionary({
            version: 2,
            fingerprint: 'new',
            dictionary: {
              terms: [],
              domains: [{ id: 2, logicalName: '숫자', dataType: 'BIGINT' }],
            },
          });
        }
        return result;
      },
      getRevision: () => h.store.getRevision(),
      subscribe: (listener) => h.store.subscribe(listener),
    },
    getDocument: () => h.doc,
    dictionary: { version: 1, fingerprint: 'empty', dictionary: { terms: [], domains: [] } },
  });
  const batches: TextPatchBatch[] = [];
  port.subscribe((batch) => batches.push(batch));
  port.hydrate();
  changeDictionary = true;
  h.tables.get('a')!.set('label', '새 이름');
  assert.equal(port.flush(), undefined);
  assert.equal(batches.length, 1);
  await Promise.resolve();
  assert.equal(batches.length, 2);
  assert.equal(batches[1].dictionaryVersion, 2);
  assert.equal(batches[1].baseRevision, 1);
  port.dispose();
  h.dispose();
});

test('hydration, dictionary revalidation and resync add no canvas undo items or Y.Doc updates', () => {
  const h = harness();
  seed(h);
  const undo = new Y.UndoManager([h.tables, h.edges], {
    trackedOrigins: createTrackedCanvasHistoryOrigins(),
  });
  let updates = 0;
  h.doc.on('update', () => updates++);
  h.port.hydrate();
  h.dictionary({ version: 2, fingerprint: 'changed', dictionary: { terms: [], domains: [] } });
  h.port.flush();
  h.port.resync();
  assert.equal(updates, 0);
  assert.equal(undo.undoStack.length, 0);
  assert.throws(() => h.port.resync({ text: '', revision: 9999 }), /revision/i);
  undo.destroy();
  h.dispose();
});

test('a subscribed consumer can recover a dropped batch and continue the revision chain', () => {
  const h = harness();
  seed(h);
  const port = new ErdCodeProjectionPort({
    read: h.store,
    getDocument: () => h.doc,
    dictionary: { version: 1, fingerprint: 'empty', dictionary: { terms: [], domains: [] } },
  });
  let state = { text: '', revision: 0 };
  let drop = false;
  port.subscribe((batch) => {
    if (!drop) state = applyErdCodeProjectionBatch(state, batch);
  });
  port.hydrate();
  drop = true;
  h.mutate('table:rename', { tableId: 'a', label: 'missed' });
  port.flush();
  drop = false;
  const recovered = port.resync(state)!;
  state = applyErdCodeProjectionBatch(state, recovered);
  h.mutate('table:rename', { tableId: 'a', label: 'after-recovery' });
  port.flush();
  assert.equal(
    state.text,
    generateProjection({
      revision: 0,
      nodes: yTablesMapToNodes(h.tables),
      edges: yEdgesMapToEdges(h.edges),
      dictionary: { terms: [], domains: [] },
    }).text,
  );
  port.dispose();
  h.dispose();
});

test('position/group-only batches reuse block ranges and column edits replace only invalidated blocks', () => {
  const h = harness();
  seed(h);
  h.port.hydrate();
  const blocks = h.batches.at(-1)!.blockMetadata;
  h.tables.get('a')!.set('positionX', 55);
  const position = h.port.flush()!;
  assert.deepEqual(position.invalidatedTableIds, []);
  assert.deepEqual(position.patches, []);
  assert.equal(position.blockMetadata, blocks);
  h.doc.getMap('groups').set('group', 'changed');
  const group = h.port.flush()!;
  assert.deepEqual(group.invalidatedTableIds, []);
  assert.equal(group.blockMetadata, blocks);
  h.check();
  h.dispose();
});
