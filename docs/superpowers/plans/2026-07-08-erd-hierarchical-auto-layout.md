# ERD Hierarchical Auto Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) `superpowers:executing-plans` implement plan task-by-task. Steps use checkbox (`- [ ]`) syntax tracking.

**Goal:** Upgrade ERD auto layout from a balanced non-overlap grid into a relationship-aware hierarchical ERD layout while preserving zero-overlap behavior.

**Architecture:** Keep `applyErdLayout(nodes, edges, options?)` as the public API. Replace the component-level snake-grid placement with a hierarchical component pipeline: classify table roles, assign ranks from references, order ranks by relationship weight, wrap wide ranks, then reuse component packing and collision resolution as the final safety net.

**Tech Stack:** TypeScript, React Flow node/edge types, Yjs-backed existing canvas persistence, Node test runner, Vite.

## Global Constraints

- Keep the existing no-overlap behavior.
- Preserve a reasonable rectangle-like overall shape.
- Make parent-to-child reference flow visible.
- Place high-degree domain hub tables near the structural center of their component.
- Keep mapping/detail/history tables close to the tables they explain.
- Reduce obvious edge crossings inside each component.
- Keep output deterministic for tests and collaborative persistence.
- Keep the existing "자동 정렬" button and persistence behavior.
- Do not add user-facing layout settings in this iteration.
- Do not redesign edge rendering or waypoint editing.
- Do not replace React Flow or the Yjs canvas store.
- Do not reintroduce ELK as the primary persisted auto layout engine.
- Avoid adding new dependencies.
- Keep the public `applyErdLayout` contract stable.
- Keep the existing collision resolution pass as the last stage.

---

## Task 1: RED Tests for ERD Semantics

**Files:**

- Modify: `client/test/unit/erd-auto-layout.test.ts`

**Interfaces:**

- Consumes: existing `applyErdLayout(nodes, edges, options?)`, `measureErdNode(node)`.
- Produces: failing tests that define ERD-like behavior before production changes.

- [ ] **Step 1: Add helper functions for center, rank direction, and distance**

Add these helpers after the existing `box` helper in `client/test/unit/erd-auto-layout.test.ts`:

```ts
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
```

- [ ] **Step 2: Add branching parent-child rank test**

Append this test near the existing chain layout tests:

```ts
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
```

- [ ] **Step 3: Add mapping table proximity test**

Append:

```ts
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
```

- [ ] **Step 4: Add hub centering test**

Append:

```ts
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
```

- [ ] **Step 5: Add cyclic component determinism test**

Append:

```ts
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
```

- [ ] **Step 6: Run tests and verify RED**

Run:

```bash
cd client
npm run test:unit -- erd-auto-layout
```

Expected: at least one of the newly added tests fails because the current snake-grid component layout does not deliberately center hubs or place mapping/detail tables by ERD semantics.

Do not commit the failing test state.

---

## Task 2: Add Role Classification and Graph Metadata

**Files:**

- Modify: `client/src/lib/auto-layout.ts`
- Test: `client/test/unit/erd-auto-layout.test.ts`

**Interfaces:**

- Consumes: existing `GraphIndex`, `measureErdNode`, `Node<TableNodeData>`.
- Produces internal types:
  - `type ErdTableRole = 'hub' | 'mapping' | 'detail' | 'history' | 'leaf' | 'regular'`
  - `interface ErdNodeLayoutMeta`
  - `function buildNodeLayoutMeta(...)`

- [ ] **Step 1: Add internal role and metadata types**

In `client/src/lib/auto-layout.ts`, after `interface RelativeLayout`, add:

```ts
type ErdTableRole = 'hub' | 'mapping' | 'detail' | 'history' | 'leaf' | 'regular';

interface ErdNodeLayoutMeta {
  id: string;
  role: ErdTableRole;
  originalIndex: number;
  incomingCount: number;
  outgoingCount: number;
  undirectedDegree: number;
  hubScore: number;
}
```

- [ ] **Step 2: Add normalized label helper and classifier**

Add below `measureErdNode`:

```ts
function getNodeSearchText(node: Node<TableNodeData>): string {
  return [
    node.id,
    node.data.label,
    node.data.logicalTableName,
    ...((node.data.columns ?? []).flatMap((column) => [column.name, column.logicalName]) ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function classifyErdTable(node: Node<TableNodeData>, graph: GraphIndex): ErdTableRole {
  const searchText = getNodeSearchText(node);
  const incomingCount = graph.incoming.get(node.id)?.size ?? 0;
  const outgoingCount = graph.outgoing.get(node.id)?.size ?? 0;
  const undirectedDegree = graph.undirected.get(node.id)?.size ?? 0;

  if (/\b(mapping|map|rel|relation|xref)\b|_mapping|_map|_rel/.test(searchText)) {
    return 'mapping';
  }
  if (/\b(history|log|audit)\b|_history|_log|_audit/.test(searchText)) {
    return 'history';
  }
  if (/\b(item|detail|attendee|participant)\b|_item|_detail|_attendee|_participant/.test(searchText)) {
    return 'detail';
  }
  if (undirectedDegree >= 4 || outgoingCount >= 4) {
    return 'hub';
  }
  if (incomingCount > 0 && outgoingCount === 0) {
    return 'leaf';
  }
  return 'regular';
}
```

- [ ] **Step 3: Add metadata builder**

Add below `classifyErdTable`:

```ts
function buildNodeLayoutMeta(
  nodes: Node<TableNodeData>[],
  graph: GraphIndex,
  originalIndexById: Map<string, number>,
): Map<string, ErdNodeLayoutMeta> {
  return new Map(
    nodes.map((node) => {
      const incomingCount = graph.incoming.get(node.id)?.size ?? 0;
      const outgoingCount = graph.outgoing.get(node.id)?.size ?? 0;
      const undirectedDegree = graph.undirected.get(node.id)?.size ?? 0;

      return [
        node.id,
        {
          id: node.id,
          role: classifyErdTable(node, graph),
          originalIndex: originalIndexById.get(node.id) ?? 0,
          incomingCount,
          outgoingCount,
          undirectedDegree,
          hubScore: incomingCount + outgoingCount + undirectedDegree,
        },
      ];
    }),
  );
}
```

- [ ] **Step 4: Use metadata only as a tie-breaker in existing ordering**

Modify `orderComponentNodes` signature:

```ts
function orderComponentNodes(
  componentNodes: Node<TableNodeData>[],
  graph: GraphIndex,
  originalIndexById: Map<string, number>,
  metaById?: Map<string, ErdNodeLayoutMeta>,
): Node<TableNodeData>[] {
```

Replace final sort tie-breaker with:

```ts
  return orderedIds
    .map((id) => nodesById.get(id))
    .filter((node): node is Node<TableNodeData> => !!node)
    .sort((left, right) => {
      const levelDelta = (level.get(left.id) ?? 0) - (level.get(right.id) ?? 0);
      if (levelDelta !== 0) return levelDelta;

      const leftMeta = metaById?.get(left.id);
      const rightMeta = metaById?.get(right.id);
      const hubDelta = (rightMeta?.hubScore ?? 0) - (leftMeta?.hubScore ?? 0);
      if (hubDelta !== 0) return hubDelta;

      return orderedIds.indexOf(left.id) - orderedIds.indexOf(right.id);
    });
```

- [ ] **Step 5: Wire metadata in `applyErdLayout` without changing placement yet**

Inside `applyErdLayout`, after `graph` creation:

```ts
    const metaById = buildNodeLayoutMeta(nodes, graph, originalIndexById);
```

Then call:

```ts
layoutComponent(orderComponentNodes(componentNodes, graph, originalIndexById, metaById), targetAspect)
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd client
npm run test:unit -- erd-auto-layout
```

Expected: existing tests still pass; new semantic tests may still fail. This task only adds metadata and safe tie-breaking.

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/auto-layout.ts client/test/unit/erd-auto-layout.test.ts
git commit -m "Add ERD layout role metadata"
```

---

## Task 3: Implement Hierarchical Rank Assignment

**Files:**

- Modify: `client/src/lib/auto-layout.ts`
- Test: `client/test/unit/erd-auto-layout.test.ts`

**Interfaces:**

- Consumes: `GraphIndex`, `ErdNodeLayoutMeta`.
- Produces:
  - `interface RankedNodePlacement`
  - `function assignHierarchicalRanks(...)`
  - `function groupNodesByRank(...)`

- [ ] **Step 1: Add rank placement interface**

After `interface ErdNodeLayoutMeta`, add:

```ts
interface RankedNodePlacement {
  node: Node<TableNodeData>;
  rank: number;
  order: number;
}
```

- [ ] **Step 2: Add helper for role rank adjustments**

Add below `buildNodeLayoutMeta`:

```ts
function getRoleRankAdjustment(role: ErdTableRole): number {
  if (role === 'mapping') return 1;
  if (role === 'detail' || role === 'history' || role === 'leaf') return 1;
  return 0;
}
```

- [ ] **Step 3: Implement rank assignment**

Add below `getRoleRankAdjustment`:

```ts
function assignHierarchicalRanks(
  componentNodes: Node<TableNodeData>[],
  graph: GraphIndex,
  metaById: Map<string, ErdNodeLayoutMeta>,
): RankedNodePlacement[] {
  const componentIds = new Set(componentNodes.map((node) => node.id));
  const indegree = new Map<string, number>();
  const rankById = new Map<string, number>();

  componentNodes.forEach((node) => {
    indegree.set(
      node.id,
      Array.from(graph.incoming.get(node.id) ?? []).filter((sourceId) => componentIds.has(sourceId)).length,
    );
    rankById.set(node.id, 0);
  });

  const ready = componentNodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((left, right) => {
      const leftMeta = metaById.get(left.id);
      const rightMeta = metaById.get(right.id);
      return (rightMeta?.hubScore ?? 0) - (leftMeta?.hubScore ?? 0) || (leftMeta?.originalIndex ?? 0) - (rightMeta?.originalIndex ?? 0);
    });
  const visited = new Set<string>();

  while (ready.length > 0) {
    const node = ready.shift();
    if (!node || visited.has(node.id)) continue;
    visited.add(node.id);

    Array.from(graph.outgoing.get(node.id) ?? [])
      .filter((targetId) => componentIds.has(targetId))
      .forEach((targetId) => {
        const targetMeta = metaById.get(targetId);
        const nextRank = (rankById.get(node.id) ?? 0) + 1 + getRoleRankAdjustment(targetMeta?.role ?? 'regular');
        rankById.set(targetId, Math.max(rankById.get(targetId) ?? 0, nextRank));
        indegree.set(targetId, (indegree.get(targetId) ?? 0) - 1);
        if ((indegree.get(targetId) ?? 0) === 0) {
          const targetNode = componentNodes.find((candidate) => candidate.id === targetId);
          if (targetNode) ready.push(targetNode);
        }
      });

    ready.sort((left, right) => {
      const leftMeta = metaById.get(left.id);
      const rightMeta = metaById.get(right.id);
      return (rightMeta?.hubScore ?? 0) - (leftMeta?.hubScore ?? 0) || (leftMeta?.originalIndex ?? 0) - (rightMeta?.originalIndex ?? 0);
    });
  }

  componentNodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const predecessorRank = Array.from(graph.incoming.get(node.id) ?? [])
      .filter((sourceId) => componentIds.has(sourceId))
      .reduce((highestRank, sourceId) => Math.max(highestRank, rankById.get(sourceId) ?? 0), 0);
    rankById.set(node.id, predecessorRank + getRoleRankAdjustment(metaById.get(node.id)?.role ?? 'regular'));
  });

  return componentNodes.map((node) => ({
    node,
    rank: rankById.get(node.id) ?? 0,
    order: metaById.get(node.id)?.originalIndex ?? 0,
  }));
}
```

- [ ] **Step 4: Add group helper**

Add:

```ts
function groupNodesByRank(placements: RankedNodePlacement[]): RankedNodePlacement[][] {
  const ranks = new Map<number, RankedNodePlacement[]>();
  placements.forEach((placement) => {
    if (!ranks.has(placement.rank)) ranks.set(placement.rank, []);
    ranks.get(placement.rank)?.push(placement);
  });

  return Array.from(ranks.entries())
    .sort(([leftRank], [rightRank]) => leftRank - rightRank)
    .map(([, rankPlacements]) => rankPlacements);
}
```

- [ ] **Step 5: Add temporary hierarchical layout wrapper that still uses existing geometry**

Add this function above `layoutComponent`:

```ts
function layoutHierarchicalComponent(
  componentNodes: Node<TableNodeData>[],
  graph: GraphIndex,
  metaById: Map<string, ErdNodeLayoutMeta>,
  targetAspect: number,
): RelativeLayout {
  const rankedPlacements = assignHierarchicalRanks(componentNodes, graph, metaById);
  const orderedNodes = rankedPlacements
    .sort((left, right) => left.rank - right.rank || left.order - right.order)
    .map((placement) => placement.node);

  return layoutComponent(orderedNodes, targetAspect);
}
```

This keeps geometry unchanged while validating rank order behavior.

- [ ] **Step 6: Wire `applyErdLayout` to use `layoutHierarchicalComponent`**

Replace the component map in `applyErdLayout` with:

```ts
    const components = getWeakComponents(nodes, graph).map((componentNodes) =>
      layoutHierarchicalComponent(componentNodes, graph, metaById, targetAspect),
    );
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd client
npm run test:unit -- erd-auto-layout
```

Expected: branching parent-child test should pass or move closer to passing; hub/mapping geometry tests may still fail because rank geometry is still snake-grid based.

- [ ] **Step 8: Commit**

```bash
git add client/src/lib/auto-layout.ts client/test/unit/erd-auto-layout.test.ts
git commit -m "Rank ERD layout by relationships"
```

---

## Task 4: Replace Component Snake Grid with Hierarchical Geometry

**Files:**

- Modify: `client/src/lib/auto-layout.ts`
- Test: `client/test/unit/erd-auto-layout.test.ts`

**Interfaces:**

- Consumes: `assignHierarchicalRanks`, `groupNodesByRank`, `measureErdNode`.
- Produces:
  - `function orderRanksByRelationshipWeight(...)`
  - `function layoutHierarchicalComponent(...)` with true rank-column geometry.

- [ ] **Step 1: Add rank ordering function**

Add below `groupNodesByRank`:

```ts
function orderRanksByRelationshipWeight(
  ranks: RankedNodePlacement[][],
  graph: GraphIndex,
  metaById: Map<string, ErdNodeLayoutMeta>,
): RankedNodePlacement[][] {
  const orderedRanks = ranks.map((rank) =>
    [...rank].sort((left, right) => {
      const hubDelta = (metaById.get(right.node.id)?.hubScore ?? 0) - (metaById.get(left.node.id)?.hubScore ?? 0);
      return hubDelta || left.order - right.order;
    }),
  );

  for (let pass = 0; pass < 2; pass += 1) {
    for (let rankIndex = 1; rankIndex < orderedRanks.length; rankIndex += 1) {
      const previousOrder = new Map(orderedRanks[rankIndex - 1].map((placement, index) => [placement.node.id, index]));
      orderedRanks[rankIndex].sort((left, right) => {
        const leftAverage = getNeighborOrderAverage(left.node.id, graph.incoming, previousOrder, left.order);
        const rightAverage = getNeighborOrderAverage(right.node.id, graph.incoming, previousOrder, right.order);
        return leftAverage - rightAverage || left.order - right.order;
      });
    }

    for (let rankIndex = orderedRanks.length - 2; rankIndex >= 0; rankIndex -= 1) {
      const nextOrder = new Map(orderedRanks[rankIndex + 1].map((placement, index) => [placement.node.id, index]));
      orderedRanks[rankIndex].sort((left, right) => {
        const leftAverage = getNeighborOrderAverage(left.node.id, graph.outgoing, nextOrder, left.order);
        const rightAverage = getNeighborOrderAverage(right.node.id, graph.outgoing, nextOrder, right.order);
        return leftAverage - rightAverage || left.order - right.order;
      });
    }
  }

  return orderedRanks;
}
```

- [ ] **Step 2: Add neighbor average helper**

Add above `orderRanksByRelationshipWeight`:

```ts
function getNeighborOrderAverage(
  nodeId: string,
  neighborMap: Map<string, Set<string>>,
  neighborOrder: Map<string, number>,
  fallback: number,
): number {
  const orders = Array.from(neighborMap.get(nodeId) ?? [])
    .map((neighborId) => neighborOrder.get(neighborId))
    .filter((order): order is number => typeof order === 'number');

  if (orders.length === 0) return fallback;
  return orders.reduce((sum, order) => sum + order, 0) / orders.length;
}
```

- [ ] **Step 3: Replace `layoutHierarchicalComponent` with rank-column geometry**

Replace the temporary implementation from Task 3 with:

```ts
function layoutHierarchicalComponent(
  componentNodes: Node<TableNodeData>[],
  graph: GraphIndex,
  metaById: Map<string, ErdNodeLayoutMeta>,
  targetAspect: number,
): RelativeLayout {
  const rankedPlacements = assignHierarchicalRanks(componentNodes, graph, metaById);
  const orderedRanks = orderRanksByRelationshipWeight(groupNodesByRank(rankedPlacements), graph, metaById);

  const rankWidths = orderedRanks.map((rank) =>
    Math.max(...rank.map((placement) => measureErdNode(placement.node).width), MIN_RENDERED_NODE_WIDTH),
  );
  const rankHeights = orderedRanks.map((rank) =>
    rank.reduce((height, placement, index) => {
      const size = measureErdNode(placement.node);
      return height + size.height + (index === 0 ? 0 : NODE_ROW_SPACING);
    }, 0),
  );
  const componentHeight = Math.max(...rankHeights, 0);

  const rankX: number[] = [];
  for (let index = 0; index < rankWidths.length; index += 1) {
    rankX[index] = index === 0 ? 0 : rankX[index - 1] + rankWidths[index - 1] + NODE_COLUMN_SPACING;
  }

  const laidOutNodes: Node<TableNodeData>[] = [];
  orderedRanks.forEach((rank, rankIndex) => {
    let currentY = Math.max(0, (componentHeight - rankHeights[rankIndex]) / 2);
    rank.forEach((placement) => {
      laidOutNodes.push({
        ...placement.node,
        position: {
          x: rankX[rankIndex] ?? 0,
          y: currentY,
        },
      });
      currentY += measureErdNode(placement.node).height + NODE_ROW_SPACING;
    });
  });

  const componentBounds = getLayoutBounds(laidOutNodes);
  return { nodes: laidOutNodes, width: componentBounds.width, height: componentBounds.height };
}
```

- [ ] **Step 4: Run RED/GREEN semantic tests**

Run:

```bash
cd client
npm run test:unit -- erd-auto-layout
```

Expected: branching parent-child and hub centering tests pass. Mapping proximity may still fail until role-aware rank positioning is added in Task 5.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/auto-layout.ts client/test/unit/erd-auto-layout.test.ts
git commit -m "Lay out ERD components by hierarchy"
```

---

## Task 5: Add Role-Aware Rank Positioning and Rank Wrapping

**Files:**

- Modify: `client/src/lib/auto-layout.ts`
- Test: `client/test/unit/erd-auto-layout.test.ts`

**Interfaces:**

- Consumes: hierarchical geometry from Task 4.
- Produces:
  - role-aware ordering for mapping/detail/history/leaf tables,
  - wrapped ranks for wide components.

- [ ] **Step 1: Add role priority helper**

Add below `getRoleRankAdjustment`:

```ts
function getRoleOrderPriority(role: ErdTableRole): number {
  if (role === 'hub') return 0;
  if (role === 'regular') return 1;
  if (role === 'mapping') return 2;
  if (role === 'detail') return 3;
  if (role === 'history') return 4;
  if (role === 'leaf') return 5;
  return 6;
}
```

- [ ] **Step 2: Include role priority in rank ordering tie-breakers**

In `orderRanksByRelationshipWeight`, update each final tie-breaker to:

```ts
        const leftRole = getRoleOrderPriority(metaById.get(left.node.id)?.role ?? 'regular');
        const rightRole = getRoleOrderPriority(metaById.get(right.node.id)?.role ?? 'regular');
        return leftAverage - rightAverage || leftRole - rightRole || left.order - right.order;
```

Apply the same tie-breaker pattern to the right-to-left sweep and initial rank sort.

- [ ] **Step 3: Add target rank height helper**

Add above `layoutHierarchicalComponent`:

```ts
function getTargetRankHeight(nodes: Node<TableNodeData>[], targetAspect: number): number {
  const averageSize = getAverageMeasuredSize(nodes);
  const estimatedArea = nodes.reduce((area, node) => {
    const size = measureErdNode(node);
    return area + size.width * size.height;
  }, 0);
  return Math.max(
    averageSize.height * 2 + NODE_ROW_SPACING,
    Math.sqrt(estimatedArea / Math.max(targetAspect, 0.1)),
  );
}
```

- [ ] **Step 4: Add rank lane wrapper**

Add:

```ts
function wrapRankIntoLanes(
  rank: RankedNodePlacement[],
  targetRankHeight: number,
): RankedNodePlacement[][] {
  const lanes: RankedNodePlacement[][] = [];
  let currentLane: RankedNodePlacement[] = [];
  let currentHeight = 0;

  rank.forEach((placement) => {
    const nodeHeight = measureErdNode(placement.node).height;
    const nextHeight = currentHeight + (currentLane.length === 0 ? 0 : NODE_ROW_SPACING) + nodeHeight;

    if (currentLane.length > 0 && nextHeight > targetRankHeight) {
      lanes.push(currentLane);
      currentLane = [placement];
      currentHeight = nodeHeight;
      return;
    }

    currentLane.push(placement);
    currentHeight = nextHeight;
  });

  if (currentLane.length > 0) lanes.push(currentLane);
  return lanes;
}
```

- [ ] **Step 5: Update hierarchical geometry to place rank lanes**

In `layoutHierarchicalComponent`, replace direct `orderedRanks.forEach` placement with lane placement:

```ts
  const targetRankHeight = getTargetRankHeight(componentNodes, targetAspect);
  const rankLanes = orderedRanks.map((rank) => wrapRankIntoLanes(rank, targetRankHeight));
  const flattenedRankWidths = rankLanes.map((lanes) =>
    lanes.reduce((width, lane, laneIndex) => {
      const laneWidth = Math.max(...lane.map((placement) => measureErdNode(placement.node).width), MIN_RENDERED_NODE_WIDTH);
      return width + laneWidth + (laneIndex === 0 ? 0 : NODE_COLUMN_SPACING);
    }, 0),
  );
  const rankHeights = rankLanes.map((lanes) =>
    Math.max(
      ...lanes.map((lane) =>
        lane.reduce((height, placement, index) => height + measureErdNode(placement.node).height + (index === 0 ? 0 : NODE_ROW_SPACING), 0),
      ),
      0,
    ),
  );
```

Then use `flattenedRankWidths` for `rankX`, and place each lane inside the rank:

```ts
  rankLanes.forEach((lanes, rankIndex) => {
    let laneX = rankX[rankIndex] ?? 0;
    lanes.forEach((lane) => {
      const laneWidth = Math.max(...lane.map((placement) => measureErdNode(placement.node).width), MIN_RENDERED_NODE_WIDTH);
      const laneHeight = lane.reduce(
        (height, placement, index) => height + measureErdNode(placement.node).height + (index === 0 ? 0 : NODE_ROW_SPACING),
        0,
      );
      let currentY = Math.max(0, (componentHeight - laneHeight) / 2);

      lane.forEach((placement) => {
        laidOutNodes.push({
          ...placement.node,
          position: { x: laneX, y: currentY },
        });
        currentY += measureErdNode(placement.node).height + NODE_ROW_SPACING;
      });

      laneX += laneWidth + NODE_COLUMN_SPACING;
    });
  });
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd client
npm run test:unit -- erd-auto-layout
```

Expected: all new semantic tests and existing overlap/aspect tests pass.

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/auto-layout.ts client/test/unit/erd-auto-layout.test.ts
git commit -m "Add role-aware ERD rank wrapping"
```

---

## Task 6: Add Relationship Quality Browser Probe

**Files:**

- Create: `client/test/e2e/erd-auto-layout-quality.spec.ts` if the project already has Playwright test wiring.
- Otherwise create: `client/scripts/qa/erd-auto-layout-quality.mjs`
- Modify: `client/package.json` only if adding a script matches existing script conventions.

**Interfaces:**

- Consumes: running frontend `http://127.0.0.1:4503`, backend `http://localhost:9503`, QA account, existing ERD route.
- Produces: repeatable browser QA that reports overlap count, aspect ratio, left-to-right edge percentage, and reload persistence.

- [ ] **Step 1: Inspect existing E2E/script conventions**

Run:

```bash
cd client
find test tests scripts -maxdepth 3 -type f | sort | grep -E 'playwright|e2e|qa|browser' | sed -n '1,120p'
```

Expected: identify whether this repo prefers Playwright specs or standalone scripts.

- [ ] **Step 2: Create the browser probe in the matching location**

If using standalone script, create `client/scripts/qa/erd-auto-layout-quality.mjs` with:

```js
import { chromium } from 'playwright';
import fs from 'node:fs';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = fs.existsSync(chromePath) ? chromePath : undefined;
const loginId = process.env.SMART_ERD_QA_LOGIN_ID;
const password = process.env.SMART_ERD_QA_PASSWORD;

if (!loginId || !password) {
  throw new Error('SMART_ERD_QA_LOGIN_ID and SMART_ERD_QA_PASSWORD are required');
}

function overlapArea(left, right) {
  return Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left)) *
    Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
}

async function collectMetrics(page) {
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length > 50, null, { timeout: 30000 });
  await page.waitForTimeout(700);

  const snapshot = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.react-flow__node')].map((element) => {
      const rect = element.getBoundingClientRect();
      const transform = element.style.transform || '';
      const match = /translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/.exec(transform);
      return {
        id: element.getAttribute('data-id') || '',
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        x: match ? Number(match[1]) : 0,
        y: match ? Number(match[2]) : 0,
      };
    });
    const edges = [...document.querySelectorAll('.react-flow__edge')].length;
    return { nodes, edges };
  });

  let overlapCount = 0;
  for (let leftIndex = 0; leftIndex < snapshot.nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < snapshot.nodes.length; rightIndex += 1) {
      if (overlapArea(snapshot.nodes[leftIndex], snapshot.nodes[rightIndex]) > 4) overlapCount += 1;
    }
  }

  const left = Math.min(...snapshot.nodes.map((node) => node.left));
  const right = Math.max(...snapshot.nodes.map((node) => node.right));
  const top = Math.min(...snapshot.nodes.map((node) => node.top));
  const bottom = Math.max(...snapshot.nodes.map((node) => node.bottom));

  const edgeDirection = await page.evaluate(async () => {
    const storeModule = await import('/src/stores/useCanvasStore.ts');
    const store = storeModule.default;
    const state = store.getState();
    const positions = new Map(state.nodes.map((node) => [node.id, node.position]));
    const directed = state.edges.filter((edge) => positions.has(edge.source) && positions.has(edge.target));
    const rightward = directed.filter((edge) => positions.get(edge.target).x > positions.get(edge.source).x).length;
    return { directed: directed.length, rightward };
  });

  return {
    nodeCount: snapshot.nodes.length,
    edgeCount: snapshot.edges,
    width: Math.round(right - left),
    height: Math.round(bottom - top),
    aspect: Number(((right - left) / (bottom - top)).toFixed(3)),
    overlapCount,
    edgeDirection,
  };
}

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

await page.goto('http://127.0.0.1:4503/login', { waitUntil: 'domcontentloaded' });
await page.locator('#login-id').fill(loginId);
await page.locator('#password').fill(password);
await Promise.all([
  page.waitForURL(/\/teams/, { timeout: 30000 }),
  page.getByRole('button', { name: /^로그인$/ }).click(),
]);

await page.goto('http://127.0.0.1:4503/teams/1/projects/2/diagrams/10', { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /자동\s*정렬/ }).waitFor({ state: 'visible', timeout: 30000 });
const before = await collectMetrics(page);
await page.getByRole('button', { name: /자동\s*정렬/ }).click();
await page.waitForTimeout(2500);
const after = await collectMetrics(page);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /자동\s*정렬/ }).waitFor({ state: 'visible', timeout: 30000 });
const reload = await collectMetrics(page);

console.log(JSON.stringify({ before, after, reload }, null, 2));
await browser.close();

if (after.overlapCount !== 0 || reload.overlapCount !== 0) process.exit(1);
```

- [ ] **Step 3: Run browser probe manually**

Run with servers already started:

```bash
cd client
node scripts/qa/erd-auto-layout-quality.mjs
```

Expected: script exits with `SMART_ERD_QA_LOGIN_ID and SMART_ERD_QA_PASSWORD are required`.

Then run:

```bash
cd client
SMART_ERD_QA_LOGIN_ID="$SMART_ERD_QA_LOGIN_ID" SMART_ERD_QA_PASSWORD="$SMART_ERD_QA_PASSWORD" node scripts/qa/erd-auto-layout-quality.mjs
```

Expected: `after.overlapCount` and `reload.overlapCount` are `0`; output includes aspect and edge direction metrics.

- [ ] **Step 4: Commit**

```bash
git add client/scripts/qa/erd-auto-layout-quality.mjs client/package.json
git commit -m "Add ERD auto layout quality probe"
```

If no package script was added, omit `client/package.json` from the `git add` command.

---

## Task 7: Full Verification and Final Commit Gate

**Files:**

- No planned source changes.
- Uses all files modified in previous tasks.

**Interfaces:**

- Consumes: completed hierarchical layout implementation.
- Produces: verified branch ready for user review.

- [ ] **Step 1: Run focused unit tests**

```bash
cd client
npm run test:unit -- erd-auto-layout erd-layout-commit
```

Expected: `# fail 0`.

- [ ] **Step 2: Run TypeScript check**

```bash
cd client
npx tsc --noEmit --pretty false
```

Expected: exit code `0`.

- [ ] **Step 3: Run production build**

```bash
cd client
npm run build
```

Expected: exit code `0`.

- [ ] **Step 4: Run browser QA on GH 도급 ERD**

```bash
cd client
SMART_ERD_QA_LOGIN_ID="$SMART_ERD_QA_LOGIN_ID" SMART_ERD_QA_PASSWORD="$SMART_ERD_QA_PASSWORD" node scripts/qa/erd-auto-layout-quality.mjs
```

Expected:

- `after.overlapCount` is `0`.
- `reload.overlapCount` is `0`.
- `after.nodeCount` is `104` for the current GH 도급 fixture.
- `after.aspect` remains below `2.4`.

- [ ] **Step 5: Check diff hygiene**

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits `0`; status only shows intentional committed or staged files.

- [ ] **Step 6: Confirm browser probe does not commit secrets**

Confirm the script reads credentials from `SMART_ERD_QA_LOGIN_ID` and `SMART_ERD_QA_PASSWORD`, and that no literal password exists in tracked script files:

```bash
grep -R "SMART_ERD_QA_PASSWORD=.*[[:graph:]]" client/scripts
```

Expected: no hard-coded assignment with a literal password.

- [ ] **Step 7: Final status report**

Report:

- commits created,
- unit/type/build/browser verification commands,
- GH 도급 metrics before/after/reload,
- any remaining ERD aesthetic limitations.

Do not claim completion without the command outputs from Steps 1-5.

---

## Self-Review Checklist

- Spec coverage:
  - No-overlap retained by existing and new tests.
  - Rectangle-like shape retained by aspect assertions.
  - Parent-child flow covered by branching and chain tests.
  - Hub placement covered by hub centering test.
  - Mapping/detail/history proximity covered by role tests.
  - Determinism covered by cyclic component test.
  - Browser QA covers GH 도급 after click and reload.
- Placeholder scan:
  - This plan contains no open-ended implementation placeholders.
- Type consistency:
  - New internal functions consume existing `Node<TableNodeData>`, `Edge`, and `GraphIndex` shapes.
  - Public `applyErdLayout` remains unchanged.
