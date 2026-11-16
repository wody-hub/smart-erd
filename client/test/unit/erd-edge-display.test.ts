import assert from 'node:assert/strict';
import test from 'node:test';
import type { Edge } from '@xyflow/react';
import { applyEdgeDisplayState } from '../../src/components/erd/edgeDisplay';

test('keeps edge references when display state already matches', () => {
  const edge = {
    id: 'edge-1',
    source: 'table-1',
    target: 'table-2',
    selected: true,
    animated: false,
  } as Edge;

  const result = applyEdgeDisplayState([edge], 'edge-1', true);

  assert.strictEqual(result[0], edge);
});

test('copies only edges whose highlight display state changes', () => {
  const unchanged = {
    id: 'edge-1',
    source: 'table-1',
    target: 'table-2',
    selected: false,
    animated: false,
  } as Edge;
  const highlighted = {
    id: 'edge-2',
    source: 'table-2',
    target: 'table-3',
    selected: false,
    animated: false,
  } as Edge;

  const result = applyEdgeDisplayState([unchanged, highlighted], 'edge-2', false);

  assert.strictEqual(result[0], unchanged);
  assert.notStrictEqual(result[1], highlighted);
  assert.equal(result[1].selected, true);
  assert.equal(result[1].animated, true);
});
