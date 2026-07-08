import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Node } from '@xyflow/react';
import { commitErdLayoutNodes } from '../../src/lib/erd-layout-commit.js';
import type { TableNodeData } from '../../src/types/erd.js';

function node(id: string, x: number, y: number): Node<TableNodeData> {
  return {
    id,
    type: 'table',
    position: { x, y },
    data: {
      label: id,
      columns: [],
    },
  };
}

test('commitErdLayoutNodes writes every layout position through document move commands', () => {
  const moved: Array<{ id: string; x: number; y: number; origin: unknown }> = [];
  const fallbackNodes: Node<TableNodeData>[][] = [];

  const status = commitErdLayoutNodes(
    [node('users', 40, 50), node('orders', 600, 50)],
    {
      available: true,
      moveTable: (id, x, y, meta) => {
        moved.push({ id, x, y, origin: meta?.origin });
        return 'applied';
      },
    },
    (nodes) => fallbackNodes.push(nodes),
    () => assert.fail('layout move commands should not be rejected'),
  );

  assert.equal(status, 'applied');
  assert.deepEqual(
    moved.map((entry) => ({ id: entry.id, x: entry.x, y: entry.y })),
    [
      { id: 'users', x: 40, y: 50 },
      { id: 'orders', x: 600, y: 50 },
    ],
  );
  assert.deepEqual(
    moved.map((entry) => entry.origin),
    [
      { source: 'local', requestId: 'canvas-user-layout' },
      { source: 'local', requestId: 'canvas-user-layout' },
    ],
  );
  assert.deepEqual(fallbackNodes, [[node('users', 40, 50), node('orders', 600, 50)]]);
});

test('commitErdLayoutNodes falls back to local canvas layout when document actions are unavailable', () => {
  const layoutNodes = [node('users', 40, 50)];
  const fallbackNodes: Node<TableNodeData>[][] = [];

  const status = commitErdLayoutNodes(
    layoutNodes,
    {
      available: false,
      moveTable: () => {
        assert.fail('unavailable document actions should not receive move commands');
      },
    },
    (nodes) => fallbackNodes.push(nodes),
    () => assert.fail('unavailable document actions should not be rejected'),
  );

  assert.equal(status, 'applied');
  assert.deepEqual(fallbackNodes, [layoutNodes]);
});

test('commitErdLayoutNodes reports rejection from document move commands', () => {
  let rejectedCount = 0;
  const layoutNodes = [node('users', 40, 50)];
  const fallbackNodes: Node<TableNodeData>[][] = [];

  const status = commitErdLayoutNodes(
    layoutNodes,
    {
      available: true,
      moveTable: () => 'rejected',
    },
    (nodes) => fallbackNodes.push(nodes),
    () => {
      rejectedCount += 1;
    },
  );

  assert.equal(status, 'rejected');
  assert.equal(rejectedCount, 1);
  assert.deepEqual(fallbackNodes, [layoutNodes]);
});
