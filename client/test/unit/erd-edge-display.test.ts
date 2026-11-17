import assert from 'node:assert/strict';
import test from 'node:test';
import * as Y from 'yjs';
import { createEdgeYMap, getEdgesMap, yEdgeYMapToEdge } from '../../src/collaboration/yjsBridge.js';
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

test('projected edges retain unrelated references across highlight and drag toggles', () => {
  const doc = new Y.Doc();
  try {
    const edgesMap = getEdgesMap(doc);
    edgesMap.set('first', createEdgeYMap('a', 'b'));
    edgesMap.set('second', createEdgeYMap('b', 'c'));
    const edges = [...edgesMap].map(([id, edge]) => yEdgeYMapToEdge(id, edge));
    const initial = applyEdgeDisplayState(edges, null, false);
    const highlighted = applyEdgeDisplayState(edges, 'first', false);
    const dragging = applyEdgeDisplayState(edges, 'first', true);
    const cleared = applyEdgeDisplayState(edges, null, false);
    assert.equal(initial[1], edges[1]);
    assert.equal(highlighted[1], initial[1]);
    assert.equal(dragging[1], highlighted[1]);
    assert.equal(cleared[1], dragging[1]);
    assert.equal(highlighted[0].animated, true);
    assert.equal(dragging[0].animated, false);
    assert.equal(cleared[0].selected ?? false, false);
  } finally {
    doc.destroy();
  }
});
