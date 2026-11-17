import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectionMonacoModel } from '../helpers/projection-monaco-model.js';
import {
  layoutEditableProjection,
  replaceEditableBlock,
} from '../../src/lib/dsl-editable-projection-model.js';
import { generateProjection } from '../../src/lib/dsl-block-projection.js';

test('real Monaco: pushEditOperations records typing; applyEdits adds no undo entries', async () => {
  const model = await createProjectionMonacoModel('one\ntwo\n', true);
  try {
    model.pushEditOperations(
      null,
      [
        {
          range: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 4 },
          text: 'local',
        },
      ],
      () => null,
    );
    model.pushStackElement();
    assert.equal(model.canUndo(), true);
    await model.undo();
    assert.equal(model.getValue(), 'one\ntwo\n');
    await model.redo();
    assert.equal(model.getValue(), 'one\nlocal\n');
  } finally {
    model.dispose();
  }
  const clean = await createProjectionMonacoModel('one\ntwo\n', true);
  try {
    replaceEditableBlock(
      clean,
      { startLineNumber: 1, startColumn: 1, endLineNumber: 2, endColumn: 1 },
      'remote\n',
    );
    assert.equal(clean.canUndo(), false);
    assert.equal(clean.canRedo(), false);
    assert.equal(clean.getValue(), 'remote\ntwo\n');
  } finally {
    clean.dispose();
  }
});
test('mixed layout preserves dirty column ID-relative ranges after a preceding rename', () => {
  const projection = generateProjection({
    revision: 1,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: ['a', 'b'].map((id) => ({
      id,
      data: { label: id, columns: [{ id: 'c', name: 'value', type: 'INT' }] },
    })),
  });
  const blocks = projection.blocks.map((block) =>
    block.tableId === 'a' ? { ...block, text: block.text.replace('a {', 'long_name {') } : block,
  );
  const next = layoutEditableProjection(blocks, 2);
  const b = next.blocks[1];
  assert.equal(
    next.text.slice(b.columnRanges[0].start, b.columnRanges[0].end),
    '  value ::INT [NN]',
  );
  assert.equal(b.columnRanges[0].columnId, 'c');
  assert.ok(b.tableRange.start > projection.blocks[1].tableRange.start);
});
