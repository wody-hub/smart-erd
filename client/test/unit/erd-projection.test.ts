import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mergeProjectedEntitiesById,
  mergeProjectedNodesById,
} from '../../src/lib/erd-projection.js';
import type { Node } from '@xyflow/react';
import type { TableNodeData } from '../../src/types/erd.js';

test('node merge preserves local runtime state without leaking old document fields or other node properties', () => {
  const current: Node<TableNodeData> = {
    id: 'table',
    type: 'table',
    position: { x: 0, y: 0 },
    data: { label: 'Old', columns: [{ id: 'a', name: 'old', type: 'TEXT' }] },
    measured: { width: 420, height: 100 },
    selected: false,
    dragging: true,
    resizing: true,
    hidden: true,
    style: { color: 'red' },
  };
  const projected: Node<TableNodeData> = {
    id: 'table',
    type: 'table',
    position: { x: 0, y: 0 },
    data: {
      label: 'New',
      handleLayout: 'split',
      columns: [{ id: 'a', name: 'new', type: 'TEXT' }],
    },
  };
  const untouched = { ...current, id: 'other' };
  const [next, other] = mergeProjectedNodesById([current, untouched], new Set(['table']), [
    projected,
  ]);
  assert.equal(next.data, projected.data);
  assert.equal(next.position, projected.position);
  assert.equal(next.measured, current.measured);
  assert.equal(next.selected, false);
  assert.equal(next.dragging, true);
  assert.equal(next.resizing, true);
  assert.equal(next.hidden, undefined);
  assert.equal(next.style, undefined);
  assert.equal(other, untouched);
  assert.equal(current.data.label, 'Old');
  assert.equal(projected.measured, undefined);
});

test('node merge deletes missing nodes and does not recover measurements on subsequent same-ID insertion', () => {
  const projected: Node<TableNodeData> = {
    id: 'table',
    type: 'table',
    position: { x: 0, y: 0 },
    data: { label: 'Table', columns: [] },
  };
  const current = { ...projected, measured: { width: 420, height: 100 }, selected: true };
  const ids = new Set(['table']);
  assert.equal(mergeProjectedNodesById([current], new Set(), [])[0], current);
  const deleted = mergeProjectedNodesById([current], ids, []);
  assert.deepEqual(deleted, []);
  assert.equal(mergeProjectedNodesById(deleted, ids, [projected])[0], projected);
  assert.equal(mergeProjectedNodesById([current], ids, [projected], ids)[0], projected);
});

test('mergeProjectedEntitiesById replaces one of many entities and keeps every other reference ordered', () => {
  const current = Array.from({ length: 200 }, (_, index) => ({
    id: `table-${index}`,
    data: { label: `Table ${index}` },
  }));
  const renamed = { ...current[87], data: { label: 'Renamed table' } };

  const next = mergeProjectedEntitiesById(current, new Set([renamed.id]), [renamed]);

  assert.equal(next.length, current.length);
  assert.deepEqual(
    next.map((node) => node.id),
    current.map((node) => node.id),
  );
  assert.equal(next[87], renamed);
  for (let index = 0; index < current.length; index += 1) {
    if (index !== 87) assert.equal(next[index], current[index]);
  }
});
