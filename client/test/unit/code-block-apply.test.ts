import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { createColumnYMap, getTablesMap } from '../../src/collaboration/yjsBridge.js';
import type {
  CodeBlockCommit,
  CodeBlockCommitResult,
} from '../../src/lib/code-block-commit-contract.js';

/** 실제 문서에 strict 명령을 전달하여 부분 쓰기를 검출한다. */
function harness() {
  const doc = new Y.Doc();
  const columns = new Y.Array<Y.Map<unknown>>();
  columns.push([
    createColumnYMap({ id: 'id', name: 'id', type: 'INT', pk: true, nullable: false }),
    createColumnYMap({ id: 'name', name: 'name', type: 'TEXT' }),
  ]);
  const table = new Y.Map<unknown>([
    ['label', 'users'],
    ['positionX', 1],
    ['positionY', 2],
    ['columns', columns],
  ]);
  getTablesMap(doc).set('a', table);
  const applier = new ErdDocumentMutationApplier(
    new YjsSharedDocumentEngine(doc),
    () => {},
    () => 'empty',
  );
  const commit: CodeBlockCommit = {
    kind: 'code-block-v1',
    commitId: 'commit-1',
    tableId: 'a',
    dictionaryFingerprint: 'empty',
    patches: [
      { target: 'table', tableId: 'a', field: 'label', baseValue: 'users', nextValue: 'people' },
    ],
  };
  return {
    doc,
    table,
    commit,
    apply: () =>
      applier.apply<CodeBlockCommitResult>({
        key: 'code-block:commit',
        payload: { ...commit },
        affectedScopes: [],
      }),
  };
}

test('strict command returns applied metadata and changes the intended field', () => {
  const h = harness();
  const result = h.apply();
  assert.equal(result.applied, true);
  assert.deepEqual(result.value, {
    status: 'applied',
    commitId: 'commit-1',
    changedFields: 1,
    noop: false,
  });
  assert.equal(h.table.get('label'), 'people');
  h.doc.destroy();
});

test('a missing column rejects every field without even migrating legacy storage', () => {
  const h = harness();
  h.commit.patches.push({
    target: 'column',
    tableId: 'a',
    columnId: 'missing',
    field: 'name',
    baseValue: 'x',
    nextValue: 'y',
  });
  const before = Y.encodeStateAsUpdate(h.doc);
  const result = h.apply();
  assert.equal(result.applied, false);
  assert.deepEqual(result.value, {
    status: 'rejected',
    commitId: 'commit-1',
    reason: 'missing-target',
    patchIndex: 1,
  });
  assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
  assert.equal(h.table.has('columnsById'), false);
  h.doc.destroy();
});

import {
  ensureColumnStorage,
  getColumnYMap,
  deleteTableColumn,
} from '../../src/collaboration/yjs-columns.js';
import {
  CANVAS_HISTORY_ORIGIN,
  createTrackedCanvasHistoryOrigins,
} from '../../src/constants/canvas-history.js';
import {
  createEdgeYMap,
  createWaypointsYArray,
  getEdgesMap,
} from '../../src/collaboration/yjsBridge.js';
import { applyCodeBlockCommit } from '../../src/collaboration/plugins/erd/erd-code-block-commit.js';
import { shouldScheduleCodeModeSnapshotPersist } from '../../src/lib/code-mode-snapshot-persist.js';

/** 컬럼 하나의 필드 패치를 작성한다. */
function columnPatch(
  columnId = 'id',
  field: 'name' | 'logicalName' | 'type' | 'pk' | 'nullable' = 'name',
  baseValue: string | boolean | null = 'id',
  nextValue: string | boolean | null = 'user_id',
) {
  return { target: 'column' as const, tableId: 'a', columnId, field, baseValue, nextValue };
}

/** 쓰기나 숨은 이관 없이 원자 거절되는지 검사한다. */
function assertRejected(h: ReturnType<typeof harness>, reason: string) {
  const before = Y.encodeStateAsUpdate(h.doc);
  const result = h.apply();
  assert.equal(result.applied, false);
  assert.equal(result.value?.status, 'rejected');
  if (result.value?.status === 'rejected') assert.equal(result.value.reason, reason);
  assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
  h.doc.destroy();
}

for (const patch of [
  { ...columnPatch(), field: 'fk' },
  { ...columnPatch(), nextValue: true },
  { ...columnPatch('id', 'pk', true, false), nextValue: 'false' },
  { ...columnPatch(), tableId: 'b' },
  { ...columnPatch(), nextValue: '' },
  { ...columnPatch(), nextValue: null },
  { ...columnPatch(), columnId: '' },
  { ...columnPatch(), type: 'extra' },
  { ...columnPatch(), target: 'edge' },
  { ...columnPatch(), baseValue: undefined },
]) {
  test(`invalid patch rejects before any field or legacy migration: ${JSON.stringify(patch)}`, () => {
    const h = harness();
    h.commit.patches.push(patch as never);
    assertRejected(h, 'invalid');
  });
}

test('duplicate field patches and unknown top-level fields are invalid', () => {
  const h = harness();
  h.commit.patches.push(h.commit.patches[0]);
  assertRejected(h, 'invalid');
  const other = harness();
  Object.assign(other.commit, { edges: [] });
  assertRejected(other, 'invalid');
});

test('all conflicting fields are returned and nonconflicting fields are not applied', () => {
  const h = harness();
  h.table.set('label', 'remote');
  getColumnYMap(h.table, 'id')!.set('name', 'remote_id');
  h.commit.patches.push(columnPatch(), columnPatch('name', 'type', 'TEXT', 'INT'));
  const before = Y.encodeStateAsUpdate(h.doc);
  const result = h.apply().value;
  assert.deepEqual(result, {
    status: 'rejected',
    commitId: 'commit-1',
    reason: 'conflict',
    conflicts: [
      { patchIndex: 0, baseValue: 'users', currentValue: 'remote', nextValue: 'people' },
      { patchIndex: 1, baseValue: 'id', currentValue: 'remote_id', nextValue: 'user_id' },
    ],
  });
  assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
  h.doc.destroy();
});

test('already applied and empty commits create no transaction, migration, or undo item', () => {
  for (const empty of [false, true]) {
    const h = harness();
    if (empty) h.commit.patches = [];
    else h.commit.patches[0].nextValue = 'users';
    const undo = new Y.UndoManager(getTablesMap(h.doc), {
      trackedOrigins: createTrackedCanvasHistoryOrigins(),
    });
    const before = Y.encodeStateAsUpdate(h.doc);
    let transactions = 0;
    h.doc.on('afterTransaction', () => transactions++);
    assert.deepEqual(h.apply().value, {
      status: 'applied',
      commitId: 'commit-1',
      changedFields: 0,
      noop: true,
    });
    assert.equal(transactions, 0);
    assert.equal(undo.undoStack.length, 0);
    assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
    undo.destroy();
    h.doc.destroy();
  }
});

test('case insensitive physical duplicates reject while a simultaneous swap is valid', () => {
  const h = harness();
  h.commit.patches.push(columnPatch('id', 'name', 'id', 'NAME'));
  assertRejected(h, 'duplicate-name');
  const swap = harness();
  swap.commit.patches = [
    columnPatch('id', 'name', 'id', 'name'),
    columnPatch('name', 'name', 'name', 'id'),
  ];
  assert.equal(swap.apply().applied, true);
  assert.equal(getColumnYMap(swap.table, 'id')!.get('name'), 'name');
  assert.equal(getColumnYMap(swap.table, 'name')!.get('name'), 'id');
  swap.doc.destroy();
});

for (const link of ['termId', 'domainId', 'tableTermId']) {
  test(`${link} blocks linked name/type edits without migration`, () => {
    const h = harness();
    if (link === 'tableTermId') h.table.set(link, 7);
    else {
      getColumnYMap(h.table, 'id')!.set(link, 7);
      h.commit.patches.push(columnPatch('id', 'type', 'INT', 'TEXT'));
    }
    assertRejected(h, 'dictionary-linked');
  });
}

test('linked columns still accept PK/NN patches and exact value echoes are noops', () => {
  const h = harness();
  getColumnYMap(h.table, 'id')!.set('termId', 7);
  h.commit.patches = [
    columnPatch('id', 'pk', true, false),
    columnPatch('id', 'nullable', false, true),
    columnPatch('id', 'name', 'old', 'id'),
  ];
  assert.deepEqual(h.apply().value, {
    status: 'applied',
    commitId: 'commit-1',
    changedFields: 2,
    noop: false,
  });
  assert.equal(getColumnYMap(h.table, 'id')!.get('pk'), false);
  h.doc.destroy();
});

test('dictionary changes reject before all writes', () => {
  const h = harness();
  h.commit.dictionaryFingerprint = 'old';
  assertRejected(h, 'dictionary-changed');
});

test('patch semantics preserve edges byte for byte, IDs and all unrelated fields', () => {
  const h = harness();
  const edges = getEdgesMap(h.doc);
  const edge = createEdgeYMap(
    'a',
    'a',
    'a-id-source-right',
    'a-name-target-left',
    'identifying',
    'straight',
  );
  edges.set('edge-preserved', edge);
  edge.set(
    'waypoints',
    createWaypointsYArray([
      { x: 30, y: 40 },
      { x: 60, y: 70 },
    ]),
  );
  const beforeEdges = JSON.stringify(edges.toJSON());
  let edgeWrites = 0;
  edges.observeDeep(() => edgeWrites++);
  h.table.set('headerColor', 'red');
  getColumnYMap(h.table, 'id')!.set('autoIncrement', true);
  h.commit.patches.push(columnPatch(), columnPatch('name', 'logicalName', null, '표시명'));
  assert.equal(h.apply().applied, true);
  assert.equal(JSON.stringify(edges.toJSON()), beforeEdges);
  assert.equal(edgeWrites, 0);
  assert.equal(edges.get('edge-preserved'), edge);
  assert.equal(h.table.get('positionX'), 1);
  assert.equal(h.table.get('positionY'), 2);
  assert.equal(h.table.get('headerColor'), 'red');
  assert.equal(getColumnYMap(h.table, 'id')!.get('autoIncrement'), true);
  assert.deepEqual([...(h.table.get('columnsById') as Y.Map<unknown>).keys()].sort(), [
    'id',
    'name',
  ]);
  h.doc.destroy();
});

test('logical null removes only the requested field and omitted boolean defaults compare semantically', () => {
  const h = harness();
  h.table.set('logicalTableName', '사용자');
  h.commit.patches = [
    {
      target: 'table',
      tableId: 'a',
      field: 'logicalTableName',
      baseValue: '사용자',
      nextValue: null,
    },
    columnPatch('name', 'pk', false, true),
    columnPatch('name', 'nullable', false, true),
  ];
  assert.equal(h.apply().applied, true);
  assert.equal(h.table.has('logicalTableName'), false);
  assert.equal(getColumnYMap(h.table, 'name')!.get('pk'), true);
  assert.equal(getColumnYMap(h.table, 'name')!.get('nullable'), true);
  h.doc.destroy();
});

test('one commit is one undo step and another document remote edits stay out of undo', () => {
  const h = harness();
  ensureColumnStorage(h.table);
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(h.doc));
  const undo = new Y.UndoManager(getTablesMap(h.doc), {
    trackedOrigins: createTrackedCanvasHistoryOrigins(),
    captureTimeout: 60_000,
  });
  const apply = (commit: CodeBlockCommit) =>
    applyCodeBlockCommit(h.doc, commit, {
      dictionaryFingerprint: 'empty',
      stopHistoryCapture: () => undo.stopCapturing(),
    });
  h.commit.patches.push(columnPatch());
  let updates = 0;
  h.doc.on('update', (_update, origin) => {
    if (origin === CANVAS_HISTORY_ORIGIN.USER_CODE_COMMIT) updates++;
  });
  assert.equal(apply(h.commit).status, 'applied');
  const next: CodeBlockCommit = {
    ...h.commit,
    commitId: 'commit-2',
    patches: [columnPatch('name', 'type', 'TEXT', 'VARCHAR(20)')],
  };
  assert.equal(apply(next).status, 'applied');
  assert.equal(updates, 2);
  assert.equal(undo.undoStack.length, 2);
  const vector = Y.encodeStateVector(h.doc);
  getColumnYMap(getTablesMap(remote).get('a')!, 'name')!.set('logicalName', '원격 값');
  Y.applyUpdate(h.doc, Y.encodeStateAsUpdate(remote, vector), 'remote');
  assert.equal(undo.undoStack.length, 2);
  undo.undo();
  assert.equal(getColumnYMap(h.table, 'name')!.get('type'), 'TEXT');
  assert.equal(h.table.get('label'), 'people');
  assert.equal(getColumnYMap(h.table, 'id')!.get('name'), 'user_id');
  undo.undo();
  assert.equal(h.table.get('label'), 'users');
  assert.equal(getColumnYMap(h.table, 'id')!.get('name'), 'id');
  assert.equal(getColumnYMap(h.table, 'name')!.get('logicalName'), '원격 값');
  assert.equal(shouldScheduleCodeModeSnapshotPersist(CANVAS_HISTORY_ORIGIN.USER_CODE_COMMIT), true);
  undo.destroy();
  remote.destroy();
  h.doc.destroy();
});

test('legacy migration survives undo and a remote edit after the migration is preserved', () => {
  const h = harness();
  const undo = new Y.UndoManager(getTablesMap(h.doc), {
    trackedOrigins: createTrackedCanvasHistoryOrigins(),
  });
  h.commit.patches.push(columnPatch());
  applyCodeBlockCommit(h.doc, h.commit, {
    dictionaryFingerprint: 'empty',
    stopHistoryCapture: () => undo.stopCapturing(),
  });
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(h.doc));
  getColumnYMap(getTablesMap(remote).get('a')!, 'name')!.set('type', 'DATE');
  Y.applyUpdate(h.doc, Y.encodeStateAsUpdate(remote), 'remote');
  undo.undo();
  assert.equal(h.table.has('columnsById'), true);
  assert.equal(getColumnYMap(h.table, 'id')!.get('name'), 'id');
  assert.equal(getColumnYMap(h.table, 'name')!.get('type'), 'DATE');
  undo.destroy();
  remote.destroy();
  h.doc.destroy();
});

test('unobserved simultaneous same-field edits converge in both update orders, including legacy migration', () => {
  for (const reverse of [false, true]) {
    const h = harness();
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(h.doc));
    const vector = Y.encodeStateVector(h.doc);
    h.commit.patches = [columnPatch()];
    assert.equal(h.apply().applied, true);
    assert.equal(
      applyCodeBlockCommit(
        peer,
        { ...h.commit, commitId: 'peer', patches: [columnPatch('id', 'name', 'id', 'peer_id')] },
        { dictionaryFingerprint: 'empty' },
      ).status,
      'applied',
    );
    const left = Y.encodeStateAsUpdate(h.doc, vector),
      right = Y.encodeStateAsUpdate(peer, vector);
    if (reverse) {
      Y.applyUpdate(peer, left, 'remote');
      Y.applyUpdate(h.doc, right, 'remote');
    } else {
      Y.applyUpdate(h.doc, right, 'remote');
      Y.applyUpdate(peer, left, 'remote');
    }
    assert.deepEqual(getTablesMap(h.doc).toJSON(), getTablesMap(peer).toJSON());
    peer.destroy();
    h.doc.destroy();
  }
});

for (const target of ['table', 'column']) {
  test(`observed remote ${target} deletion is missing-target and never recreates it`, () => {
    const h = harness();
    ensureColumnStorage(h.table);
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(h.doc));
    if (target === 'table') getTablesMap(peer).delete('a');
    else deleteTableColumn(getTablesMap(peer).get('a')!, 'id');
    Y.applyUpdate(h.doc, Y.encodeStateAsUpdate(peer), 'remote');
    h.commit.patches.push(columnPatch());
    assertRejected(h, 'missing-target');
    peer.destroy();
  });
}

test('malformed current column values reject instead of throwing or migrating', () => {
  const h = harness();
  getColumnYMap(h.table, 'name')!.set('name', 123);
  assertRejected(h, 'invalid');
});

test('a mixed noop/conflict-free commit writes only one changed field in one user transaction', () => {
  const h = harness();
  ensureColumnStorage(h.table);
  h.commit.patches[0].nextValue = 'users';
  h.commit.patches.push(columnPatch());
  const transactions: Y.Transaction[] = [];
  h.doc.on('afterTransaction', (transaction) => transactions.push(transaction));
  assert.deepEqual(h.apply().value, {
    status: 'applied',
    commitId: 'commit-1',
    changedFields: 1,
    noop: false,
  });
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].origin, CANVAS_HISTORY_ORIGIN.USER_CODE_COMMIT);
  assert.equal(
    [...transactions[0].changed].find(([body]) => Object.is(body, h.table)),
    undefined,
  );
  assert.deepEqual(
    [
      ...[...transactions[0].changed].find(([body]) =>
        Object.is(body, getColumnYMap(h.table, 'id')),
      )![1],
    ],
    ['name'],
  );
  h.doc.destroy();
});

import { computeBlockCommit } from '../../src/lib/code-block-commit.js';
import { generateTableBlock } from '../../src/lib/dsl-block-projection.js';
import { yTablesMapToNodes } from '../../src/collaboration/yjsBridge.js';

test('A delta for removing NN from an omitted nullable field applies and reprojects as editable text', () => {
  const h = harness();
  const snapshot = {
    revision: 1,
    nodes: yTablesMapToNodes(getTablesMap(h.doc)),
    edges: [],
    dictionary: { terms: [], domains: [] },
  };
  const base = generateTableBlock('a', snapshot);
  const edited = base.text.replace(' [NN]', '');
  assert.notEqual(edited, base.text);
  const commit = computeBlockCommit({
    base,
    edited,
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'empty',
    commitId: 'from-A',
  });
  assert.ok('kind' in commit);
  if (!('kind' in commit)) return;
  Object.assign(h.commit, commit);
  assert.deepEqual(h.apply().value, {
    status: 'applied',
    commitId: 'from-A',
    changedFields: 1,
    noop: false,
  });
  assert.equal(
    generateTableBlock('a', { ...snapshot, nodes: yTablesMapToNodes(getTablesMap(h.doc)) }).text,
    edited,
  );
  h.doc.destroy();
});

for (const field of ['label', 'logicalTableName'] as const)
  test(`strict applier rejects table rename colliding with ${field}`, () => {
    const h = harness();
    getTablesMap(h.doc).set('b', new Y.Map<unknown>([[field, 'people']]));
    const before = Y.encodeStateAsUpdate(h.doc);
    const result = h.apply().value!;
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') assert.equal(result.reason, 'duplicate-name');
    assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
    h.doc.destroy();
  });

import { duplicateColumnNames } from '../../src/lib/code-block-names.js';
import { readColumnYMaps } from '../../src/collaboration/yjs-columns.js';

for (const canvas of [false, true])
  for (const reverse of [false, true])
    test(`${canvas ? 'existing canvas' : 'strict code'} concurrent column renames expose merged duplicates (${reverse ? 'reverse' : 'forward'})`, () => {
      const h = harness();
      ensureColumnStorage(h.table);
      const peer = new Y.Doc();
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(h.doc));
      const docs = reverse ? [peer, h.doc] : [h.doc, peer];
      for (const [index, doc] of docs.entries()) {
        const colId = index === 0 ? 'id' : 'name';
        if (canvas) {
          const applier = new ErdDocumentMutationApplier(
            new YjsSharedDocumentEngine(doc),
            () => {},
          );
          assert.equal(
            applier.apply({
              key: 'column:update',
              payload: { tableId: 'a', colId, name: 'same' },
              affectedScopes: [],
            }).applied,
            true,
          );
        } else {
          assert.equal(
            applyCodeBlockCommit(
              doc,
              {
                ...h.commit,
                patches: [
                  {
                    target: 'column',
                    tableId: 'a',
                    columnId: colId,
                    field: 'name',
                    baseValue: colId,
                    nextValue: 'same',
                  },
                ],
              },
              { dictionaryFingerprint: 'empty' },
            ).status,
            'applied',
          );
        }
      }
      Y.applyUpdate(docs[0], Y.encodeStateAsUpdate(docs[1]));
      Y.applyUpdate(docs[1], Y.encodeStateAsUpdate(docs[0]));
      for (const doc of docs) {
        const columns = readColumnYMaps(getTablesMap(doc).get('a')!).map((col) => ({
          id: String(col.get('id')),
          name: String(col.get('name')),
        }));
        assert.deepEqual(
          columns.map((col) => col.name),
          ['same', 'same'],
        );
        assert.deepEqual(duplicateColumnNames(columns), [
          { name: 'same', columnIds: ['id', 'name'] },
        ]);
      }
      peer.destroy();
      h.doc.destroy();
    });

test('concurrent table rename calculated earlier is rejected on a peer that sees the first rename', () => {
  const h = harness();
  getTablesMap(h.doc).set('b', new Y.Map<unknown>([['label', 'other']]));
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(h.doc));
  assert.equal(h.apply().applied, true);
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(h.doc));
  const before = Y.encodeStateAsUpdate(peer);
  const result = applyCodeBlockCommit(
    peer,
    {
      ...h.commit,
      tableId: 'b',
      patches: [
        { target: 'table', tableId: 'b', field: 'label', baseValue: 'other', nextValue: 'people' },
      ],
    },
    { dictionaryFingerprint: 'empty' },
  );
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.equal(result.reason, 'duplicate-name');
  assert.deepEqual(Y.encodeStateAsUpdate(peer), before);
  peer.destroy();
  h.doc.destroy();
});

test('strict applier allows a logical rename crossing another physical name', () => {
  const h = harness();
  h.table.set('label', 'C');
  getTablesMap(h.doc).set(
    'b',
    new Y.Map<unknown>([
      ['label', 'B'],
      ['logicalTableName', 'D'],
    ]),
  );
  h.commit.patches = [
    { target: 'table', tableId: 'a', field: 'logicalTableName', baseValue: null, nextValue: 'B' },
  ];
  assert.equal(h.apply().value!.status, 'applied');
  assert.equal(h.table.get('logicalTableName'), 'B');
  h.doc.destroy();
});
