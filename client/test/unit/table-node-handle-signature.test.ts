import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getColumnHandleRenderState,
  getTableNodeHandleRenderSignature,
} from '../../src/components/erd/tableNodeHandleSignature';

test('FK mode changes the handle signature for an otherwise unconnected row', () => {
  const rows = [{ columnId: 'column-a' }];
  const base = getTableNodeHandleRenderSignature({
    nodeId: 'table-a',
    rows,
    mode: 'static',
    fkMode: false,
    handleLayout: 'split',
  });

  const fkMode = getTableNodeHandleRenderSignature({
    nodeId: 'table-a',
    rows,
    mode: 'static',
    fkMode: true,
    handleLayout: 'split',
  });

  assert.notEqual(base, fkMode);
});

test('handle signature tracks column IDs, connection directions, layout, and row mode', () => {
  const baseInput = {
    nodeId: 'table-a',
    rows: [{ columnId: 'column-a', sourceConnected: true }],
    mode: 'static' as const,
    fkMode: false,
    handleLayout: 'split' as const,
  };
  const base = getTableNodeHandleRenderSignature(baseInput);

  assert.notEqual(
    base,
    getTableNodeHandleRenderSignature({
      ...baseInput,
      rows: [{ columnId: 'column-b', sourceConnected: true }],
    }),
  );
  assert.notEqual(
    base,
    getTableNodeHandleRenderSignature({
      ...baseInput,
      rows: [{ columnId: 'column-a', sourceConnected: true, targetConnected: true }],
    }),
  );
  assert.notEqual(base, getTableNodeHandleRenderSignature({ ...baseInput, handleLayout: 'left' }));
  assert.notEqual(base, getTableNodeHandleRenderSignature({ ...baseInput, mode: 'editable' }));
});

test('editable and static rows share the handle visibility rules used by rendering', () => {
  assert.deepEqual(
    getColumnHandleRenderState({ mode: 'static', fkMode: false, sourceConnected: true }),
    { source: true, target: false },
  );
  assert.deepEqual(
    getColumnHandleRenderState({ mode: 'editable', fkMode: false, connected: true }),
    { source: true, target: true },
  );
  assert.deepEqual(getColumnHandleRenderState({ mode: 'static', fkMode: true }), {
    source: true,
    target: true,
  });
});
