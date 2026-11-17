import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import { commitPreviewPositionOverrides } from '../../src/lib/erd-preview-position-commit.js';
import type { DslPreviewNode } from '../../src/lib/dsl-preview-graph.js';
import type { TableNode } from '../../src/types/erd.js';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { createTableYMap, getTablesMap } from '../../src/collaboration/yjsBridge.js';

function preview(id: string, label: string): DslPreviewNode {
  return { id, type: 'previewTable', position: { x: 20, y: 40 }, data: { label, columns: [] } };
}

function persisted(id: string): TableNode {
  return { id, type: 'table', position: { x: 0, y: 0 }, data: { label: id, columns: [] } };
}

function harness() {
  const doc = new Y.Doc();
  for (const id of ['a', 'b']) getTablesMap(doc).set(id, createTableYMap(id, { x: 0, y: 0 }, []));
  const applier = new ErdDocumentMutationApplier(new YjsSharedDocumentEngine(doc));
  let calls = 0;
  const actions = {
    available: true,
    applyPreviewPositions: (payload: Parameters<typeof applier.apply>[0]['payload']) => {
      calls++;
      return applier.apply({ key: 'preview-position:apply', payload, affectedScopes: [] }).applied
        ? ('applied' as const)
        : ('rejected' as const);
    },
  };
  return { doc, actions, getCalls: () => calls };
}

test('matched previews submit one atomic batch; unmatched drafts are returned and kept', () => {
  const { doc, actions, getCalls } = harness();
  let updates = 0;
  doc.on('update', () => updates++);
  const overrides = { pa: { x: 20, y: 40 }, pb: { x: 30, y: 50 }, draft: { x: 90, y: 80 } };
  const result = commitPreviewPositionOverrides(
    [preview('pa', 'a'), preview('pb', 'b'), preview('draft', 'new')],
    overrides,
    [persisted('a'), persisted('b')],
    actions,
    () => assert.fail('unexpected rejection'),
  );
  assert.equal(result.status, 'applied');
  assert.deepEqual(result.syncedPreviewNodeIds, ['pa', 'pb']);
  assert.deepEqual(result.unmatchedPreviewNodeIds, ['draft']);
  assert.deepEqual(result.remainingPositionOverrides, { draft: overrides.draft });
  assert.equal(Object.keys(overrides).length, 3);
  assert.equal(getCalls(), 1);
  assert.equal(updates, 1);
  assert.equal(getTablesMap(doc).get('a')!.get('positionX'), 20);
});

test('a remote change between preview matching and dispatch rejects all positions and keeps every draft', () => {
  const { doc, actions } = harness();
  const overrides = { pa: { x: 20, y: 40 }, pb: { x: 30, y: 50 } };
  let rejected = 0;
  const result = commitPreviewPositionOverrides(
    [preview('pa', 'a'), preview('pb', 'b')],
    overrides,
    [persisted('a'), persisted('b')],
    {
      ...actions,
      applyPreviewPositions: (payload) => {
        doc.transact(() => getTablesMap(doc).get('b')!.set('positionX', 10), 'remote');
        return actions.applyPreviewPositions(payload);
      },
    },
    () => rejected++,
  );
  assert.equal(result.status, 'rejected');
  assert.deepEqual(result.syncedPreviewNodeIds, []);
  assert.deepEqual(result.remainingPositionOverrides, overrides);
  assert.equal(getTablesMap(doc).get('a')!.get('positionX'), 0);
  assert.equal(getTablesMap(doc).get('b')!.get('positionX'), 10);
  assert.equal(rejected, 1);
});

test('unavailable preview adapter blocks writes and keeps drafts', () => {
  const overrides = { pa: { x: 20, y: 40 } };
  let rejected = 0;
  const result = commitPreviewPositionOverrides(
    [preview('pa', 'a')],
    overrides,
    [persisted('a')],
    {
      available: false,
      applyPreviewPositions: () => assert.fail('must not dispatch'),
    },
    () => rejected++,
  );
  assert.equal(result.status, 'unavailable');
  assert.equal(rejected, 1);
  assert.deepEqual(result.remainingPositionOverrides, overrides);
});

test('multiple previews matched to the same table stay unmatched and keep their drafts', () => {
  const overrides = { pa: { x: 20, y: 40 }, alias: { x: 30, y: 50 } };
  const result = commitPreviewPositionOverrides(
    [preview('pa', 'a'), preview('alias', 'a')],
    overrides,
    [persisted('a')],
    { available: true, applyPreviewPositions: () => assert.fail('ambiguous mapping') },
    () => assert.fail('no matched entries'),
  );
  assert.deepEqual(result.unmatchedPreviewNodeIds, ['pa', 'alias']);
  assert.deepEqual(result.remainingPositionOverrides, overrides);
});

test('already identical matched previews succeed without updates and clear their drafts', () => {
  const { doc, actions } = harness();
  let updates = 0;
  doc.on('update', () => updates++);
  const result = commitPreviewPositionOverrides(
    [preview('pa', 'a')],
    { pa: { x: 0, y: 0 } },
    [persisted('a')],
    actions,
    () => assert.fail('unexpected rejection'),
  );
  assert.deepEqual(result.syncedPreviewNodeIds, ['pa']);
  assert.deepEqual(result.remainingPositionOverrides, {});
  assert.equal(updates, 0);
});
