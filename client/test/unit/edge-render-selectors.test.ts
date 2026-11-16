import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { EdgeProps } from '@xyflow/react';
import {
  areErdRelationEdgePropsEqual,
  createEdgeCardinalitySelector,
} from '../../src/components/erd/edgeRenderSelectors.js';

test('edge cardinality selector preserves its result when unrelated target data changes', () => {
  const selector = createEdgeCardinalitySelector('child', 'child-col-id', 'non-identifying');
  const first = selector({
    nodeLookup: new Map([
      ['child', { data: { columns: [{ id: 'child-col-id', nullable: false }] } }],
    ]),
  });
  const afterRename = selector({
    nodeLookup: new Map([
      [
        'child',
        {
          data: {
            label: 'renamed table',
            columns: [{ id: 'child-col-id', nullable: false }],
          },
        },
      ],
    ]),
  });

  assert.equal(afterRename, first);
});

test('edge cardinality selector changes when a cardinality input changes', () => {
  const selector = createEdgeCardinalitySelector('child', 'child-col-id', 'identifying');
  const initial = selector({
    nodeLookup: new Map([
      [
        'child',
        { data: { columns: [{ id: 'child-col-id', nullable: false, pk: true, fk: true }] } },
      ],
    ]),
  });
  const changed = selector({
    nodeLookup: new Map([
      [
        'child',
        { data: { columns: [{ id: 'child-col-id', nullable: false, pk: true, fk: false }] } },
      ],
    ]),
  });

  assert.notEqual(changed, initial);
  assert.equal(changed.targetSymbol, 'many');
});

test('edge props comparator skips equivalent recreated props and detects visual changes', () => {
  const waypoints: never[] = [];
  const previousData = { relationType: 'identifying', waypoints };
  const previous = {
    id: 'edge-1',
    source: 'parent',
    target: 'child',
    sourceX: 10,
    sourceY: 20,
    targetX: 100,
    targetY: 120,
    data: previousData,
    style: { stroke: 'black', strokeWidth: 2 },
    selected: false,
  } as unknown as EdgeProps;
  const equivalent = {
    ...previous,
    data: { relationType: 'identifying', waypoints },
    style: { stroke: 'black', strokeWidth: 2 },
  } as unknown as EdgeProps;

  assert.equal(areErdRelationEdgePropsEqual(previous, equivalent), true);
  assert.equal(
    areErdRelationEdgePropsEqual(previous, {
      ...equivalent,
      selected: true,
    } as unknown as EdgeProps),
    false,
  );
});
