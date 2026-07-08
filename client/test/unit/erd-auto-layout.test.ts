import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Edge, Node } from '@xyflow/react';
import type { Column, TableNodeData } from '../../src/types/erd.js';
import { applyErdLayout, measureErdNode } from '../../src/lib/auto-layout.js';

function makeColumns(tableId: string, columns = 3): Column[] {
  return Array.from({ length: columns }, (_, index) => ({
    id: `${tableId}_c${index}`,
    name: `col_${index}`,
    type: 'varchar',
    pk: index === 0,
    fk: false,
    nullable: true,
  }));
}

function table(id: string, columns = 3, overrides: Partial<TableNodeData> = {}): Node<TableNodeData> {
  return {
    id,
    type: 'table',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      columns: makeColumns(id, columns),
      ...overrides,
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

function aspectScore(nodes: Node<TableNodeData>[]): number {
  const finalBounds = bounds(nodes);
  return Math.max(finalBounds.width / finalBounds.height, finalBounds.height / finalBounds.width);
}

function assertNoOverlaps(nodes: Node<TableNodeData>[]) {
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      assert.equal(overlaps(nodes[leftIndex], nodes[rightIndex]), false);
    }
  }
}

test('measureErdNode grows with long rendered column names', () => {
  const node = table('wide_table', 1, {
    columns: [
      {
        id: 'wide_table_c0',
        name: 'extremely_long_physical_column_name_that_expands_the_table_width',
        logicalName: 'Extremely Long Logical Column Name That Expands The Table Width',
        type: 'varchar(255)',
        pk: true,
        nullable: false,
      },
    ],
  });

  assert.ok(measureErdNode(node).width > 1_000);
});

test('applyErdLayout returns non-overlapping table positions using rendered table dimensions', async () => {
  const nodes = [
    table('users', 8),
    table('orders', 5),
    table('order_items', 6),
    table('products', 4),
    table('categories', 3),
  ];
  const edges = [
    relation('users-orders', 'users', 'orders'),
    relation('orders-items', 'orders', 'order_items'),
    relation('items-products', 'order_items', 'products'),
    relation('products-categories', 'products', 'categories'),
  ];

  const result = await applyErdLayout(nodes, edges);

  assert.equal(result.status, 'applied');
  assertNoOverlaps(result.nodes);
});

test('applyErdLayout keeps a small reference chain progressing left to right', async () => {
  const nodes = [table('account'), table('order'), table('invoice')];
  const edges = [
    relation('account-order', 'account', 'order'),
    relation('order-invoice', 'order', 'invoice'),
  ];

  const result = await applyErdLayout(nodes, edges);

  assert.equal(result.status, 'applied');
  assert.ok(result.nodes[0].position.x < result.nodes[1].position.x);
  assert.ok(result.nodes[1].position.x < result.nodes[2].position.x);
  assertNoOverlaps(result.nodes);
});

test('applyErdLayout wraps a long reference chain into a balanced snake grid', async () => {
  const nodes = Array.from({ length: 18 }, (_, index) => table(`table_${index}`, 3));
  const edges = nodes.slice(1).map((node, index) => relation(`edge_${index}`, nodes[index].id, node.id));

  const result = await applyErdLayout(nodes, edges);
  const distinctX = new Set(result.nodes.map((node) => node.position.x));
  const distinctY = new Set(result.nodes.map((node) => node.position.y));

  assert.equal(result.status, 'applied');
  assert.ok(distinctX.size >= 3);
  assert.ok(distinctY.size >= 4);
  assert.ok(aspectScore(result.nodes) <= 2.4);
  assertNoOverlaps(result.nodes);
});

test('applyErdLayout packs many isolated tables as a rectangle instead of a vertical strip', async () => {
  const nodes = Array.from({ length: 16 }, (_, index) => table(`isolated_${index}`, 2));

  const result = await applyErdLayout(nodes, []);
  const distinctX = new Set(result.nodes.map((node) => node.position.x));
  const distinctY = new Set(result.nodes.map((node) => node.position.y));

  assert.equal(result.status, 'applied');
  assert.ok(distinctX.size >= 3);
  assert.ok(distinctY.size >= 4);
  assert.ok(aspectScore(result.nodes) <= 2.4);
  assertNoOverlaps(result.nodes);
});

test('applyErdLayout prevents overlap for very wide tables', async () => {
  const wideColumns = [
    {
      id: 'wide_c0',
      name: 'very_long_physical_column_name_that_used_to_overlap_after_auto_layout',
      logicalName: 'Very Long Logical Name That Makes The Rendered Node Wider',
      type: 'varchar(255)',
      pk: true,
      nullable: false,
    },
  ];
  const nodes = [
    table('wide_a', 1, { columns: wideColumns }),
    table('wide_b', 1, { columns: wideColumns.map((column) => ({ ...column, id: 'wide_b_c0' })) }),
    table('wide_c', 1, { columns: wideColumns.map((column) => ({ ...column, id: 'wide_c_c0' })) }),
    table('wide_d', 1, { columns: wideColumns.map((column) => ({ ...column, id: 'wide_d_c0' })) }),
  ];
  const edges = [
    relation('wide-a-b', 'wide_a', 'wide_b'),
    relation('wide-b-c', 'wide_b', 'wide_c'),
    relation('wide-c-d', 'wide_c', 'wide_d'),
  ];

  const result = await applyErdLayout(nodes, edges);

  assert.equal(result.status, 'applied');
  assertNoOverlaps(result.nodes);
});

test('applyIncrementalLayoutByLabel reuses previous positions per matching label', async () => {
  const previous = [
    table('old_users', 2, { label: 'users' }),
    table('old_orders', 2, { label: 'orders' }),
  ].map((node, index) => ({
    ...node,
    position: { x: index * 100, y: index * 200 },
  }));
  const next = [table('new_users', 2, { label: 'users' }), table('new_orders', 2, { label: 'orders' })];
  const { applyIncrementalLayoutByLabel } = await import('../../src/lib/auto-layout.js');

  const result = applyIncrementalLayoutByLabel(previous, next);

  assert.deepEqual(
    result.map((node) => node.position),
    previous.map((node) => node.position),
  );
});
