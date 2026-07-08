# ERD ELK Auto Layout Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement plan task-by-task.

**Goal:** Replace the persisted ERD full auto-layout engine with an ELK-based async layout that avoids overlap, respects relationships, and chooses a more balanced rectangle-like result.

**Architecture:** Add `applyErdLayout` in `client/src/lib/auto-layout.ts` alongside the current Dagre helper, then migrate all full-layout call sites to the async helper in one buildable change. The helper builds ELK layered graphs, evaluates `RIGHT` and `DOWN` candidate layouts for medium diagrams, scores candidates by bounding-box aspect ratio, and returns an `ErdLayoutResult` with safe fallback status.

**Tech Stack:** TypeScript, React, React Flow, Yjs, `elkjs`, Node test runner, Vite.

## Global Constraints

- Add `elkjs` as a frontend dependency in `client/package.json` and `client/package-lock.json`.
- Persisted ERD auto layout must use ELK instead of Dagre.
- Full layout in code/DDL apply must await the async layout result.
- Incremental layout remains synchronous.
- Failed ELK layout must preserve original node positions and return `status: 'failed'`.
- The "자동 정렬" toolbar entry point remains unchanged from the user's perspective.
- No new user-facing layout settings in this iteration.
- Run `npm run test:unit` and `npm run build` from `client/` before completion.

---

### Task 1: Add Dependency and RED Layout Tests

**Files:**
- Modify: `client/package.json`
- Modify: `client/package-lock.json`
- Create: `client/test/unit/erd-auto-layout.test.ts`

**Interfaces:**
- Consumes: no new production interface.
- Produces: failing tests for `applyErdLayout(nodes, edges, options?)` and `measureErdNode(node)`.

- [ ] **Step 1: Install `elkjs`**

```bash
cd client
npm install elkjs
```

Expected: `client/package.json` and `client/package-lock.json` change.

- [ ] **Step 2: Write failing tests**

Create `client/test/unit/erd-auto-layout.test.ts`:

```ts
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

test('applyErdLayout keeps a simple reference chain progressing in layout direction', async () => {
  const nodes = [table('account'), table('order'), table('invoice')];
  const edges = [
    relation('account-order', 'account', 'order'),
    relation('order-invoice', 'order', 'invoice'),
  ];

  const result = await applyErdLayout(nodes, edges, { candidateDirections: ['RIGHT'] });
  const byId = new Map(result.nodes.map((node) => [node.id, node]));

  assert.equal(result.status, 'applied');
  assert.ok(byId.get('account')!.position.x < byId.get('order')!.position.x);
  assert.ok(byId.get('order')!.position.x < byId.get('invoice')!.position.x);
});

test('applyErdLayout chooses the candidate with the better aspect ratio', async () => {
  const nodes = Array.from({ length: 16 }, (_, index) => table(`table_${index}`, 4));
  const edges = nodes.slice(1).map((node, index) => relation(`edge_${index}`, nodes[index].id, node.id));

  const result = await applyErdLayout(nodes, edges, { largeGraphThreshold: 1000 });
  const finalBounds = bounds(result.nodes);
  const aspectScore = Math.max(finalBounds.width / finalBounds.height, finalBounds.height / finalBounds.width);

  assert.equal(result.status, 'applied');
  assert.ok(aspectScore <= 4);
});

test('applyErdLayout preserves original nodes when the ELK adapter fails', async () => {
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
```

- [ ] **Step 3: Verify RED**

```bash
cd client
npm run test:unit
```

Expected: FAIL because `applyErdLayout` and `measureErdNode` are not exported from `src/lib/auto-layout.ts`.

Do not commit the failing test state.

---

### Task 2: Implement ELK Helper While Keeping Existing Dagre Callers Buildable

**Files:**
- Modify: `client/src/lib/auto-layout.ts`
- Test: `client/test/unit/erd-auto-layout.test.ts`

**Interfaces:**
- Consumes: `elkjs` dependency and RED tests from Task 1.
- Produces:
  - `export type ErdLayoutDirection = 'RIGHT' | 'DOWN'`
  - `export type ErdLayoutStatus = 'applied' | 'failed'`
  - `export interface ErdLayoutResult`
  - `export interface ErdLayoutOptions`
  - `export function measureErdNode(node: Node<TableNodeData>): { width: number; height: number }`
  - `export async function applyErdLayout(nodes, edges, options?): Promise<ErdLayoutResult>`
- Preserves: existing synchronous `applyDagreLayout(nodes, edges): Node<TableNodeData>[]` until all call sites migrate.

- [ ] **Step 1: Add ELK helper code without deleting `applyDagreLayout`**

Modify `client/src/lib/auto-layout.ts`. Keep the current Dagre import and `applyDagreLayout` implementation for now. Add this ELK import and helper implementation above `applyIncrementalLayoutByLabel`:

```ts
import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';

const RENDERED_NODE_WIDTH = 420;
const ELK_NODE_NODE_SPACING = 80;
const ELK_LAYER_SPACING = 120;
const ELK_COMPONENT_SPACING = 160;
const ELK_LAYOUT_MARGIN = 40;
const DEFAULT_LARGE_GRAPH_THRESHOLD = 150;

export type ErdLayoutDirection = 'RIGHT' | 'DOWN';
export type ErdLayoutStatus = 'applied' | 'failed';

export interface ErdLayoutResult {
  nodes: Node<TableNodeData>[];
  status: ErdLayoutStatus;
}

export interface ErdLayoutOptions {
  candidateDirections?: ErdLayoutDirection[];
  largeGraphThreshold?: number;
  elkLayout?: (graph: ElkNode) => Promise<ElkNode>;
}

export function measureErdNode(node: Node<TableNodeData>): { width: number; height: number } {
  return {
    width: RENDERED_NODE_WIDTH,
    height: calculateNodeHeight(node.data.columns.length),
  };
}

function buildElkGraph(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
  direction: ErdLayoutDirection,
): ElkNode {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    id: 'erd-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.nodeNode': String(ELK_NODE_NODE_SPACING),
      'elk.spacing.componentComponent': String(ELK_COMPONENT_SPACING),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(ELK_LAYER_SPACING),
      'elk.padding': `[top=${ELK_LAYOUT_MARGIN},left=${ELK_LAYOUT_MARGIN},bottom=${ELK_LAYOUT_MARGIN},right=${ELK_LAYOUT_MARGIN}]`,
    },
    children: nodes.map((node) => {
      const size = measureErdNode(node);
      return { id: node.id, width: size.width, height: size.height };
    }),
    edges: edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map(
        (edge): ElkExtendedEdge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        }),
      ),
  };
}

function applyElkCoordinates(
  sourceNodes: Node<TableNodeData>[],
  layoutGraph: ElkNode,
): Node<TableNodeData>[] {
  const childrenById = new Map((layoutGraph.children ?? []).map((child) => [child.id, child]));
  return sourceNodes.map((node) => {
    const child = childrenById.get(node.id);
    if (typeof child?.x !== 'number' || typeof child.y !== 'number') {
      return node;
    }
    return { ...node, position: { x: child.x, y: child.y } };
  });
}

function getLayoutBounds(nodes: Node<TableNodeData>[]): { width: number; height: number } {
  if (nodes.length === 0) {
    return { width: 0, height: 0 };
  }
  const boxes = nodes.map((node) => {
    const size = measureErdNode(node);
    return {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + size.width,
      bottom: node.position.y + size.height,
    };
  });
  return {
    width: Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left)),
    height: Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top)),
  };
}

function getAspectScore(nodes: Node<TableNodeData>[]): number {
  const bounds = getLayoutBounds(nodes);
  if (bounds.width === 0 || bounds.height === 0) {
    return 1;
  }
  return Math.max(bounds.width / bounds.height, bounds.height / bounds.width);
}

function selectBestLayout(candidates: Node<TableNodeData>[][]): Node<TableNodeData>[] {
  return candidates.reduce((best, candidate) =>
    getAspectScore(candidate) < getAspectScore(best) ? candidate : best,
  );
}

export async function applyErdLayout(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
  options: ErdLayoutOptions = {},
): Promise<ErdLayoutResult> {
  if (nodes.length === 0) {
    return { nodes, status: 'applied' };
  }

  const directions =
    options.candidateDirections ??
    (nodes.length > (options.largeGraphThreshold ?? DEFAULT_LARGE_GRAPH_THRESHOLD)
      ? (['RIGHT'] as ErdLayoutDirection[])
      : (['RIGHT', 'DOWN'] as ErdLayoutDirection[]));
  const elk = new ELK();
  const layout = options.elkLayout ?? ((graph: ElkNode) => elk.layout(graph));

  try {
    const candidates: Node<TableNodeData>[][] = [];
    for (const direction of directions) {
      const graph = buildElkGraph(nodes, edges, direction);
      const layoutGraph = await layout(graph);
      candidates.push(applyElkCoordinates(nodes, layoutGraph));
    }
    return { nodes: selectBestLayout(candidates), status: 'applied' };
  } catch (error) {
    console.warn('[erd-layout] ELK layout failed', error);
    return { nodes, status: 'failed' };
  }
}
```

- [ ] **Step 2: Verify GREEN**

```bash
cd client
npm run test:unit
npm run build
```

Expected:

- `erd-auto-layout.test.ts` passes.
- Build exits `0` because old call sites still use the existing synchronous `applyDagreLayout`.

- [ ] **Step 3: Commit tests, dependency, and helper**

```bash
git add client/package.json client/package-lock.json client/test/unit/erd-auto-layout.test.ts client/src/lib/auto-layout.ts
git commit -m "feat: add ELK ERD layout helper"
```

---

### Task 3: Migrate Persisted ERD and Code Apply Full Layout to Async ELK

**Files:**
- Modify: `client/src/components/erd/ERDCanvas.tsx`
- Modify: `client/src/hooks/useApplyToErd.ts`
- Modify: `client/src/i18n/locales/ko/translation.json`
- Modify: `client/src/i18n/locales/en/translation.json`

**Interfaces:**
- Consumes: `applyErdLayout(nodes, edges): Promise<ErdLayoutResult>`.
- Produces: all full-layout production callers await ELK results; Dagre full-layout call sites are gone.

- [ ] **Step 1: Convert ERD toolbar import and handler**

In `client/src/components/erd/ERDCanvas.tsx`, replace:

```ts
import { applyDagreLayout } from '@/lib/auto-layout';
```

with:

```ts
import { applyErdLayout } from '@/lib/auto-layout';
```

Replace `handleAutoLayout` with:

```ts
const handleAutoLayout = async () => {
  const result = await applyErdLayout(nodes, edges);
  if (result.status === 'failed') {
    toast.error(t('erd.toolbar.autoLayoutFailed'));
    return;
  }

  applyLayout(result.nodes);
  requestAnimationFrame(() => {
    edgeActions.normalizeEdgeHandles(undefined, 'layout', {
      nodeOverrides: reactFlowInstance.getNodes() as Node<TableNodeData>[],
      origin: CANVAS_HISTORY_ORIGIN.USER_LAYOUT,
    });
  });
};
```

- [ ] **Step 2: Add failure copy**

Add this key under `erd.toolbar` in `client/src/i18n/locales/ko/translation.json`:

```json
"autoLayoutFailed": "자동 정렬에 실패했습니다."
```

Add this key under `erd.toolbar` in `client/src/i18n/locales/en/translation.json`:

```json
"autoLayoutFailed": "Auto layout failed."
```

- [ ] **Step 3: Convert `useApplyToErd` import**

In `client/src/hooks/useApplyToErd.ts`, replace:

```ts
import { applyDagreLayout, applyIncrementalLayoutByLabel } from '@/lib/auto-layout';
```

with:

```ts
import { applyErdLayout, applyIncrementalLayoutByLabel } from '@/lib/auto-layout';
```

- [ ] **Step 4: Make layout phase async**

Change:

```ts
function executeLayoutPhase(params: ExecuteLayoutPhaseParams): LayoutPhaseResult {
```

to:

```ts
async function executeLayoutPhase(params: ExecuteLayoutPhaseParams): Promise<LayoutPhaseResult> {
```

Replace the full-layout branch:

```ts
if (effectiveLayoutMode === 'full') {
  const layoutedNodes = applyDagreLayout(freshNodes, freshEdges);
  params.applyLayout(layoutedNodes);
}
```

with:

```ts
if (effectiveLayoutMode === 'full') {
  const layoutResult = await applyErdLayout(freshNodes, freshEdges);
  if (layoutResult.status === 'failed') {
    console.warn('[erd-sync] full layout failed; preserving existing positions');
  }
  params.applyLayout(layoutResult.nodes);
}
```

Keep the incremental branch:

```ts
if (effectiveLayoutMode === 'incremental') {
  const layoutedNodes = applyIncrementalLayoutByLabel(params.beforeNodes, freshNodes);
  params.applyLayout(layoutedNodes);
}
```

- [ ] **Step 5: Await layout phase call sites**

Find:

```ts
const layoutPhase = executeLayoutPhase({
```

Replace every occurrence in `client/src/hooks/useApplyToErd.ts` with:

```ts
const layoutPhase = await executeLayoutPhase({
```

If TypeScript reports the containing function is not async, add `async` to that containing callback and keep its existing return behavior unchanged.

- [ ] **Step 6: Verify migration**

```bash
cd client
npm run test:unit
npm run build
```

Expected:

- Unit tests pass with `fail 0`.
- Build exits `0`.
- `rg -n "applyDagreLayout\\(" client/src client/test` reports only the function declaration in `client/src/lib/auto-layout.ts`.

- [ ] **Step 7: Commit async migration**

```bash
git add client/src/components/erd/ERDCanvas.tsx client/src/hooks/useApplyToErd.ts client/src/i18n/locales/ko/translation.json client/src/i18n/locales/en/translation.json
git commit -m "feat: use ELK for ERD full auto layout"
```

---

### Task 4: Remove Dagre Full-Layout Dependency

**Files:**
- Modify: `client/src/lib/auto-layout.ts`
- Modify: `client/package.json`
- Modify: `client/package-lock.json`

**Interfaces:**
- Consumes: all full-layout call sites migrated to `applyErdLayout`.
- Produces: no `dagre` or `@types/dagre` dependency in the frontend package.

- [ ] **Step 1: Remove Dagre import and full-layout helper**

Delete from `client/src/lib/auto-layout.ts`:

```ts
import dagre from 'dagre';
```

Delete the entire `applyDagreLayout` function. Keep `applyIncrementalLayoutByLabel`.

- [ ] **Step 2: Remove Dagre packages**

```bash
rg -n "dagre|@types/dagre" client/src client/test client/package.json
cd client
npm uninstall dagre @types/dagre
```

Expected:

- The first command shows only removable package references before uninstall.
- `client/package.json` no longer contains `dagre` or `@types/dagre`.

- [ ] **Step 3: Verify cleanup**

```bash
cd client
npm run test:unit
npm run build
```

Expected:

- Unit tests pass with `fail 0`.
- Build exits `0`.

- [ ] **Step 4: Commit cleanup**

```bash
git add client/src/lib/auto-layout.ts client/package.json client/package-lock.json
git commit -m "chore: remove Dagre ERD layout dependency"
```

---

### Task 5: Browser QA for Auto Layout

**Files:**
- Optional modify: `client/src/lib/auto-layout.ts`

**Interfaces:**
- Consumes: built ELK auto layout behavior.
- Produces: verified behavior for the "자동 정렬" button.

- [ ] **Step 1: Start local frontend**

```bash
cd client
npm run dev
```

Expected: Vite prints a local URL, usually `http://localhost:5173`.

- [ ] **Step 2: Open a representative ERD**

Use an ERD containing:

- At least 8 tables.
- At least one chain of 3 related tables.
- At least one branching relation where one parent references two or more children.

- [ ] **Step 3: Click "자동 정렬"**

Expected:

- No table overlaps another table.
- Reference chains progress in a consistent direction.
- Branching tables remain visually near their parent.
- The diagram is not a single long row when a more balanced layout is possible.
- No console error appears.

- [ ] **Step 4: Verify undo and redo**

Use toolbar undo and redo after auto layout.

Expected:

- Undo restores the previous table positions.
- Redo reapplies the ELK layout positions.
- Edge handles remain connected to valid table handles.

- [ ] **Step 5: Patch spacing only for an observed spacing defect**

If QA shows tables are too tight, adjust only these constants in `client/src/lib/auto-layout.ts`:

```ts
const ELK_NODE_NODE_SPACING = 96;
const ELK_LAYER_SPACING = 144;
const ELK_COMPONENT_SPACING = 192;
```

Then run:

```bash
cd client
npm run test:unit
npm run build
```

- [ ] **Step 6: Commit QA tuning when constants changed**

```bash
git add client/src/lib/auto-layout.ts
git commit -m "tune ERD ELK layout spacing"
```

If constants did not change, skip this commit.

---

### Task 6: Final Verification and Review

**Files:**
- No planned source edits.

**Interfaces:**
- Consumes: completed implementation and browser QA.
- Produces: final verification evidence and review request.

- [ ] **Step 1: Run final verification**

```bash
cd client
npm run test:unit
npm run build
```

Expected:

- `npm run test:unit`: `fail 0`
- `npm run build`: exit code `0`

- [ ] **Step 2: Inspect repository state**

```bash
git status --short
git log --oneline -8
```

Expected:

- No uncommitted changes remain after any QA tuning patch is committed.
- Recent commits correspond to the ELK layout work.

- [ ] **Step 3: Request code review**

Use `superpowers:requesting-code-review` and focus review on:

- Async layout call path regressions.
- ELK fallback behavior.
- Test quality for overlap, reference direction, and aspect-ratio scoring.
- Dependency removal of Dagre.
