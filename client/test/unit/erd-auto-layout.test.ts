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

function center(node: Node<TableNodeData>) {
  const nodeBox = box(node);
  return {
    x: (nodeBox.left + nodeBox.right) / 2,
    y: (nodeBox.top + nodeBox.bottom) / 2,
  };
}

function byId(nodes: Node<TableNodeData>[], id: string): Node<TableNodeData> {
  const node = nodes.find((candidate) => candidate.id === id);
  assert.ok(node, `expected node ${id}`);
  return node;
}

function distance(left: Node<TableNodeData>, right: Node<TableNodeData>): number {
  const leftCenter = center(left);
  const rightCenter = center(right);
  return Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
}

function assertBefore(left: Node<TableNodeData>, right: Node<TableNodeData>) {
  assert.ok(
    left.position.x < right.position.x,
    `expected ${left.id} to be left of ${right.id}: ${left.position.x} >= ${right.position.x}`,
  );
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

test('applyErdLayout keeps branching parent before child tables', async () => {
  const nodes = [
    table('contract', 8),
    table('contract_item', 4),
    table('contract_history', 4),
    table('contract_attendee', 4),
    table('payment', 4),
  ];
  const edges = [
    relation('contract-item', 'contract', 'contract_item'),
    relation('contract-history', 'contract', 'contract_history'),
    relation('contract-attendee', 'contract', 'contract_attendee'),
    relation('contract-payment', 'contract', 'payment'),
  ];

  const result = await applyErdLayout(nodes, edges);

  assert.equal(result.status, 'applied');
  const contract = byId(result.nodes, 'contract');
  assertBefore(contract, byId(result.nodes, 'contract_item'));
  assertBefore(contract, byId(result.nodes, 'contract_history'));
  assertBefore(contract, byId(result.nodes, 'contract_attendee'));
  assertBefore(contract, byId(result.nodes, 'payment'));
  assertNoOverlaps(result.nodes);
  assert.ok(aspectScore(result.nodes) <= 2.4);
});

test('applyErdLayout places mapping tables near their referenced parents', async () => {
  const nodes = [
    table('user', 6),
    table('role', 4),
    table('user_role_mapping', 3),
    table('login_log', 3),
  ];
  const edges = [
    relation('user-mapping', 'user', 'user_role_mapping'),
    relation('role-mapping', 'role', 'user_role_mapping'),
    relation('user-log', 'user', 'login_log'),
  ];

  const result = await applyErdLayout(nodes, edges);

  assert.equal(result.status, 'applied');
  const user = byId(result.nodes, 'user');
  const role = byId(result.nodes, 'role');
  const mapping = byId(result.nodes, 'user_role_mapping');
  const log = byId(result.nodes, 'login_log');

  assertBefore(user, mapping);
  assertBefore(role, mapping);
  assert.ok(distance(mapping, user) < distance(log, role));
  assert.ok(distance(mapping, role) < distance(log, role));
  assertNoOverlaps(result.nodes);
});

test('applyErdLayout keeps high degree hub near the vertical center of its component', async () => {
  const nodes = [
    table('site', 8),
    table('contract', 4),
    table('user', 4),
    table('org', 4),
    table('file', 4),
    table('api_connection_log', 4),
    table('site_history', 4),
  ];
  const edges = [
    relation('site-contract', 'site', 'contract'),
    relation('site-user', 'site', 'user'),
    relation('site-org', 'site', 'org'),
    relation('site-file', 'site', 'file'),
    relation('site-api-log', 'site', 'api_connection_log'),
    relation('site-history', 'site', 'site_history'),
  ];

  const result = await applyErdLayout(nodes, edges);

  assert.equal(result.status, 'applied');
  const resultBounds = bounds(result.nodes);
  const siteCenterY = center(byId(result.nodes, 'site')).y;
  const componentMiddleY = resultBounds.height / 2 + Math.min(...result.nodes.map((node) => box(node).top));

  assert.ok(Math.abs(siteCenterY - componentMiddleY) <= resultBounds.height * 0.3);
  assertNoOverlaps(result.nodes);
});

test('applyErdLayout handles cyclic relationships deterministically without overlap', async () => {
  const nodes = [table('alpha', 4), table('beta', 4), table('gamma', 4), table('delta', 4)];
  const edges = [
    relation('alpha-beta', 'alpha', 'beta'),
    relation('beta-gamma', 'beta', 'gamma'),
    relation('gamma-alpha', 'gamma', 'alpha'),
    relation('gamma-delta', 'gamma', 'delta'),
  ];

  const first = await applyErdLayout(nodes, edges);
  const second = await applyErdLayout(nodes, edges);

  assert.equal(first.status, 'applied');
  assert.equal(second.status, 'applied');
  assert.deepEqual(
    first.nodes.map((node) => ({ id: node.id, position: node.position })),
    second.nodes.map((node) => ({ id: node.id, position: node.position })),
  );
  assertNoOverlaps(first.nodes);
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
