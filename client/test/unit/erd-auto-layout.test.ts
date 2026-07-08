import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Edge, Node } from '@xyflow/react';
import type { TableNodeData } from '../../src/types/erd.js';
import { applyErdLayout, measureErdNode } from '../../src/lib/auto-layout.js';

function table(id: string, columns = 3): Node<TableNodeData> {
  return {
    id,
    type: 'table',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      columns: Array.from({ length: columns }, (_, index) => ({
        id: `${id}_c${index}`,
        name: `col_${index}`,
        type: 'varchar',
        pk: index === 0,
        fk: false,
        nullable: true,
      })),
    },
  };
}

function relation(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'erdRelation' };
}

function box(node: Node<TableNodeData>) {
  const size = measureErdNode(node);
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + size.width,
    bottom: node.position.y + size.height,
  };
}

function overlaps(left: Node<TableNodeData>, right: Node<TableNodeData>): boolean {
  const a = box(left);
  const b = box(right);
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function bounds(nodes: Node<TableNodeData>[]) {
  const boxes = nodes.map(box);
  return {
    width: Math.max(...boxes.map((candidate) => candidate.right)) - Math.min(...boxes.map((candidate) => candidate.left)),
    height: Math.max(...boxes.map((candidate) => candidate.bottom)) - Math.min(...boxes.map((candidate) => candidate.top)),
  };
}

test('applyErdLayout returns non-overlapping table positions using rendered table dimensions', async () => {
  const nodes = [table('users', 8), table('orders', 6), table('payments', 6), table('shipments', 6)];
  const edges = [
    relation('users-orders', 'users', 'orders'),
    relation('orders-payments', 'orders', 'payments'),
    relation('orders-shipments', 'orders', 'shipments'),
  ];

  const result = await applyErdLayout(nodes, edges);

  assert.equal(result.status, 'applied');
  for (let i = 0; i < result.nodes.length; i += 1) {
    for (let j = i + 1; j < result.nodes.length; j += 1) {
      assert.equal(overlaps(result.nodes[i], result.nodes[j]), false);
    }
  }
});

test('applyErdLayout keeps simple reference chain progressing in layout direction', async () => {
  const nodes = [table('account'), table('order'), table('invoice')];
  const edges = [
    relation('account-order', 'account', 'order'),
    relation('order-invoice', 'order', 'invoice'),
  ];

  const result = await applyErdLayout(nodes, edges, { candidateDirections: ['RIGHT'] });

  assert.equal(result.status, 'applied');
  assert.ok(result.nodes[0].position.x < result.nodes[1].position.x);
  assert.ok(result.nodes[1].position.x < result.nodes[2].position.x);
});

test('applyErdLayout selects the candidate with the better aspect score', async () => {
  const nodes = [table('hub', 4), table('a', 4), table('b', 4), table('c', 4)];
  const edges = nodes.slice(1).map((node, index) => relation(`edge_${index}`, nodes[0].id, node.id));

  const result = await applyErdLayout(nodes, edges, {
    candidateDirections: ['RIGHT', 'DOWN'],
    elkLayout: async (graph) => {
      const direction = graph.layoutOptions?.['elk.direction'];
      const coordinates =
        direction === 'DOWN'
          ? {
              hub: { x: 0, y: 0 },
              a: { x: 360, y: 0 },
              b: { x: 0, y: 260 },
              c: { x: 360, y: 260 },
            }
          : {
              hub: { x: 0, y: 0 },
              a: { x: 0, y: 1200 },
              b: { x: 0, y: 2400 },
              c: { x: 0, y: 3600 },
            };

      return {
        ...graph,
        children: graph.children?.map((child) => ({
          ...child,
          ...coordinates[child.id as keyof typeof coordinates],
        })),
      };
    },
  });

  assert.equal(result.status, 'applied');
  assert.deepEqual(result.nodes.find((node) => node.id === 'c')?.position, { x: 360, y: 260 });
});

test('applyErdLayout preserves original nodes when ELK adapter fails', async () => {
  const nodes = [table('users'), table('orders')];
  const edges = [relation('users-orders', 'users', 'orders')];

  const result = await applyErdLayout(nodes, edges, {
    elkLayout: async () => {
      throw new Error('forced layout failure');
    },
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(
    result.nodes.map((node) => ({ id: node.id, position: node.position })),
    nodes.map((node) => ({ id: node.id, position: node.position })),
  );
});
