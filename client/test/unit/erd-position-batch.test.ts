import {
  ErdDocumentPlugin,
  isErdCanvasInputAdapter,
} from '../../src/collaboration/plugins/erd/erd-document-plugin.js';
import { DocumentStore } from '../../src/collaboration/core/store/document-store.js';
import { DocumentRevisionTracker } from '../../src/collaboration/core/store/document-revision-tracker.js';
import { ErdDocumentReadContextFactory } from '../../src/collaboration/plugins/erd/query/erd-document-read-context-factory.js';
import { collectErdAffectedScopes } from '../../src/collaboration/plugins/erd/erd-yjs-update-scope-collector.js';
import type { DocumentChangeEvent } from '../../src/collaboration/core/contracts/document-read-executor.js';
import { createTrackedCanvasHistoryOrigins } from '../../src/constants/canvas-history.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import {
  createTableYMap,
  createEdgeYMap,
  getTablesMap,
  getEdgesMap,
} from '../../src/collaboration/yjsBridge.js';
import type { DocumentMutation } from '../../src/collaboration/core/contracts/document-read-executor.js';

function harness() {
  const doc = new Y.Doc();
  const tables = getTablesMap(doc);
  tables.set('a', createTableYMap('a', { x: 0, y: 0 }, []));
  tables.set('b', createTableYMap('b', { x: 500, y: 0 }, []));
  const applier = new ErdDocumentMutationApplier(new YjsSharedDocumentEngine(doc));
  return { doc, tables, applier };
}

function batch(key = 'layout:apply'): DocumentMutation {
  return {
    key,
    affectedScopes: [],
    payload: {
      version: 1,
      batchId: 'batch-1',
      entries: [
        { tableId: 'a', from: { x: 0, y: 0 }, to: { x: 700, y: 30 } },
        { tableId: 'b', from: { x: 500, y: 0 }, to: { x: 100, y: 40 } },
      ],
    },
  };
}

for (const key of ['layout:apply', 'preview-position:apply']) {
  test(`${key} applies all positions with one Yjs update and correct origin`, () => {
    const { doc, tables, applier } = harness();
    const origins: unknown[] = [];
    doc.on('update', (_update, origin) => origins.push(origin));
    const mutation = batch(key);
    assert.equal(applier.apply(mutation).applied, true);
    assert.equal(tables.get('a')?.get('positionX'), 700);
    assert.equal(tables.get('b')?.get('positionX'), 100);
    assert.deepEqual(origins, [
      key === 'layout:apply' ? 'canvas-user-layout' : 'canvas-user-preview-position',
    ]);
    assert.deepEqual(mutation.affectedScopes.map((scope) => scope.id).sort(), ['a', 'b']);
  });
}

for (const invalid of [
  { tableId: 'missing', from: { x: 500, y: 0 }, to: { x: 1, y: 1 } },
  { tableId: 'b', from: { x: 501, y: 0 }, to: { x: 1, y: 1 } },
  { tableId: 'b', from: { x: 500, y: 0 }, to: { x: NaN, y: 1 } },
  { tableId: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
  { tableId: ' ', from: { x: 500, y: 0 }, to: { x: 1, y: 1 } },
]) {
  test(`invalid entry rejects the whole batch: ${JSON.stringify(invalid)}`, () => {
    const { doc, applier } = harness();
    const before = Y.encodeStateAsUpdate(doc);
    const mutation = batch();
    mutation.payload!.entries = [(mutation.payload!.entries as unknown[])[0], invalid];
    let updates = 0;
    doc.on('update', () => updates++);
    assert.equal(applier.apply(mutation).applied, false);
    assert.deepEqual(Y.encodeStateAsUpdate(doc), before);
    assert.equal(updates, 0);
  });
}

test('identical coordinates succeed without a transaction or update', () => {
  const { doc, applier } = harness();
  const mutation = batch();
  for (const entry of mutation.payload!.entries as { from: object; to: object }[])
    entry.to = entry.from;
  let transactions = 0;
  doc.on('afterTransaction', () => transactions++);
  assert.equal(applier.apply(mutation).applied, true);
  assert.equal(transactions, 0);
});

test('preview mapping must be one-to-one', () => {
  const { doc, applier } = harness();
  const before = Y.encodeStateAsUpdate(doc);
  const mutation = batch('preview-position:apply');
  for (const entry of mutation.payload!.entries as Record<string, unknown>[])
    entry.previewNodeId = 'same';
  assert.equal(applier.apply(mutation).applied, false);
  assert.deepEqual(Y.encodeStateAsUpdate(doc), before);
});

test('remote position change after preparation rejects all targets', () => {
  const { doc, tables, applier } = harness();
  const mutation = batch();
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
  getTablesMap(remote).get('b')!.set('positionX', 501);
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), 'remote');
  const before = Y.encodeStateAsUpdate(doc);
  assert.equal(applier.apply(mutation).applied, false);
  assert.equal(tables.get('a')!.get('positionX'), 0);
  assert.deepEqual(Y.encodeStateAsUpdate(doc), before);
});

test('edge normalization is observed atomically with positions', () => {
  const { doc, tables, applier } = harness();
  const edges = getEdgesMap(doc);
  edges.set(
    'edge',
    createEdgeYMap('a', 'b', 'a-id-source', 'b-id-target', 'non-identifying', 'straight', [
      { x: 200, y: 50 },
    ]),
  );
  const edge = edges.get('edge')!;
  const beforeHandle = edge.get('sourceHandle');
  let updates = 0;
  let transactions = 0;
  doc.on('update', () => {
    updates++;
    assert.equal(tables.get('a')!.get('positionX'), 700);
    assert.notEqual(edge.get('sourceHandle'), beforeHandle);
  });
  doc.on('afterTransaction', () => transactions++);
  const mutation = batch();
  assert.equal(applier.apply(mutation).applied, true);
  assert.equal(updates, 1);
  assert.equal(transactions, 1);
  assert.ok(mutation.affectedScopes.some((scope) => scope.kind === 'edge' && scope.id === 'edge'));
});

for (const key of ['layout:apply', 'preview-position:apply']) {
  test(`${key} is one undo step, isolated from adjacent edits and including normalized edges`, () => {
    const { doc, tables } = harness();
    const edges = getEdgesMap(doc);
    edges.set(
      'edge',
      createEdgeYMap('a', 'b', 'a-id-source', 'b-id-target', 'non-identifying', 'straight', [
        { x: 200, y: 50 },
      ]),
    );
    const before = {
      a: tables.get('a')!.toJSON(),
      b: tables.get('b')!.toJSON(),
      edge: edges.get('edge')!.toJSON(),
    };
    const origin = key === 'layout:apply' ? 'canvas-user-layout' : 'canvas-user-preview-position';
    const undo = new Y.UndoManager([tables, edges], {
      trackedOrigins: createTrackedCanvasHistoryOrigins(),
    });
    const applier = new ErdDocumentMutationApplier(new YjsSharedDocumentEngine(doc), () =>
      undo.stopCapturing(),
    );
    doc.transact(() => tables.get('a')!.set('label', 'before'), origin);
    assert.equal(applier.apply(batch(key)).applied, true);
    doc.transact(() => tables.get('b')!.set('label', 'after'), origin);
    assert.equal(undo.undoStack.length, 3);
    undo.undo();
    assert.equal(tables.get('a')!.get('positionX'), 700);
    undo.undo();
    assert.deepEqual(tables.get('a')!.toJSON(), { ...before.a, label: 'before' });
    assert.deepEqual(tables.get('b')!.toJSON(), before.b);
    assert.deepEqual(edges.get('edge')!.toJSON(), before.edge);
    undo.redo();
    assert.equal(tables.get('a')!.get('positionX'), 700);
    assert.equal(tables.get('b')!.get('positionX'), 100);
    undo.destroy();
  });
}

for (const payload of [
  { version: 2, batchId: 'x', entries: [] },
  { version: 1, batchId: ' ', entries: [] },
  { version: 1, batchId: 'x', entries: {} },
  { version: 1, batchId: 'x', entries: [null] },
  {
    version: 1,
    batchId: 'x',
    entries: [{ tableId: 'a', from: { x: 0, y: Infinity }, to: { x: 1, y: 2 } }],
  },
  {
    version: 1,
    batchId: 'x',
    entries: [{ tableId: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 2 }, previewNodeId: '' }],
  },
]) {
  test(`malformed batch rejects before writing: ${JSON.stringify(payload)}`, () => {
    const { doc, applier } = harness();
    const before = Y.encodeStateAsUpdate(doc);
    assert.equal(
      applier.apply({ key: 'layout:apply', payload, affectedScopes: [] }).applied,
      false,
    );
    assert.deepEqual(Y.encodeStateAsUpdate(doc), before);
  });
}

test('empty batch is a successful no-op', () => {
  const { applier } = harness();
  assert.equal(
    applier.apply({
      key: 'layout:apply',
      payload: { version: 1, batchId: 'empty', entries: [] },
      affectedScopes: [],
    }).applied,
    true,
  );
});

test('plugin adapters, scope policy and document events include every target and normalized edge', () => {
  const { doc, applier } = harness();
  getEdgesMap(doc).set('edge', createEdgeYMap('a', 'b', 'a-id-source', 'b-id-target'));
  const engine = new YjsSharedDocumentEngine(doc);
  const revisions = new DocumentRevisionTracker();
  const store = new DocumentStore(
    applier,
    revisions,
    new ErdDocumentReadContextFactory(engine, revisions),
    () => engine.exportSnapshot(),
    (update) => collectErdAffectedScopes(engine, update),
  );
  const plugin = new ErdDocumentPlugin();
  const context = { read: store };
  const adapter = plugin.createInputAdapters(context).canvas;
  assert.ok(isErdCanvasInputAdapter(adapter));
  const payload = {
    version: 1 as const,
    batchId: 'plugin-batch',
    entries: [
      { tableId: 'a', from: { x: 0, y: 0 }, to: { x: 700, y: 30 } },
      { tableId: 'b', from: { x: 500, y: 0 }, to: { x: 100, y: 40 } },
    ],
  };
  assert.equal(adapter.applyPreviewPositions(payload).key, 'preview-position:apply');
  const meta = { origin: { source: 'local' as const, requestId: 'test' } };
  const mutation = plugin
    .createMutationPolicy(context)
    .toMutation(adapter.applyLayout(payload), meta);
  assert.deepEqual(
    mutation.affectedScopes.map((scope) => scope.id),
    ['a', 'b'],
  );
  const events: DocumentChangeEvent[] = [];
  store.attach();
  const unsubscribe = engine.subscribeUpdates((update) => revisions.handleDocumentUpdated(update));
  store.subscribe((event) => events.push(event));
  assert.equal(store.applyMutation(mutation, meta).applied, true);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].affectedScopes.map((scope) => scope.id).sort(), ['a', 'b', 'edge']);
  unsubscribe();
  store.dispose();
});
