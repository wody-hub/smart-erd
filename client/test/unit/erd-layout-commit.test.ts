import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Node } from '@xyflow/react';
import { commitErdLayoutNodes } from '../../src/lib/erd-layout-commit.js';
import type { PositionBatch } from '../../src/collaboration/plugins/erd/erd-position-batch.js';
import type { TableNodeData } from '../../src/types/erd.js';

function node(id: string, x: number, y: number): Node<TableNodeData> {
  return { id, type: 'table', position: { x, y }, data: { label: id, columns: [] } };
}

test('layout submits one batch with positions captured before calculation', () => {
  const batches: PositionBatch[] = [];
  const status = commitErdLayoutNodes(
    [node('users', 40, 50), node('orders', 600, 50)],
    [node('users', 0, 0), node('orders', 100, 0)],
    {
      available: true,
      applyLayout: (batch) => {
        batches.push(batch);
        return 'applied';
      },
    },
    () => assert.fail('unexpected rejection'),
  );
  assert.equal(status, 'applied');
  assert.equal(batches.length, 1);
  assert.equal(batches[0].version, 1);
  assert.ok(batches[0].batchId);
  assert.deepEqual(batches[0].entries, [
    { tableId: 'users', from: { x: 0, y: 0 }, to: { x: 40, y: 50 } },
    { tableId: 'orders', from: { x: 100, y: 0 }, to: { x: 600, y: 50 } },
  ]);
});

for (const result of ['unavailable', 'rejected'] as const) {
  test(`layout reports ${result} without any local fallback`, () => {
    let rejectedCount = 0;
    let calls = 0;
    const status = commitErdLayoutNodes(
      [node('users', 40, 50)],
      [node('users', 0, 0)],
      {
        available: result !== 'unavailable',
        applyLayout: () => {
          calls++;
          return result;
        },
      },
      () => {
        rejectedCount++;
      },
    );
    assert.equal(status, 'rejected');
    assert.equal(rejectedCount, 1);
    assert.equal(calls, result === 'unavailable' ? 0 : 1);
  });
}

test('layout handles adapter becoming unavailable at dispatch', () => {
  let rejected = 0;
  assert.equal(
    commitErdLayoutNodes(
      [node('a', 10, 20)],
      [node('a', 0, 0)],
      {
        available: true,
        applyLayout: () => 'unavailable',
      },
      () => rejected++,
    ),
    'rejected',
  );
  assert.equal(rejected, 1);
});
