# ERD Hierarchical Auto Layout Design

## Purpose

Smart ERD now has an auto layout that avoids visual overlap and produces a balanced rectangular canvas. The next problem is layout semantics: the result is readable as a packed diagram, but not yet as a conventional ERD.

This design upgrades auto layout from "non-overlapping balanced grid" to "relationship-aware ERD layout" while preserving the current overlap guarantees, collaboration persistence path, and toolbar behavior.

## Goals

- Keep the existing no-overlap behavior.
- Preserve a reasonable rectangle-like overall shape.
- Make parent-to-child reference flow visible.
- Place high-degree domain hub tables near the structural center of their component.
- Keep mapping/detail/history tables close to the tables they explain.
- Reduce obvious edge crossings inside each component.
- Keep output deterministic for tests and collaborative persistence.
- Keep the existing "자동 정렬" button and persistence behavior.

## Non-Goals

- Do not add user-facing layout settings in this iteration.
- Do not redesign edge rendering or waypoint editing.
- Do not guarantee mathematically minimal edge crossings.
- Do not replace React Flow or the Yjs canvas store.
- Do not reintroduce ELK as the primary persisted auto layout engine.

## Current System

The current implementation lives mainly in:

- `client/src/lib/auto-layout.ts`
- `client/src/lib/erd-layout-commit.ts`
- `client/src/components/erd/ERDCanvas.tsx`
- `client/src/collaboration/channel/diagram/use-diagram-erd-apply-actions.ts`
- `client/test/unit/erd-auto-layout.test.ts`
- `client/test/unit/erd-layout-commit.test.ts`

Current behavior:

1. Build weak graph components from ERD edges.
2. Topologically order nodes where possible.
3. Place ordered nodes into a snake grid.
4. Pack components into a balanced rectangle.
5. Run a final collision resolution pass.
6. Persist layout through document move commands and canvas fallback.

This is intentionally robust, but it weakens ERD semantics because all components eventually become grid rows/columns rather than parent-child layers.

## Proposed Architecture

Keep the existing file and public API:

```ts
export async function applyErdLayout(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
  options?: ErdLayoutOptions,
): Promise<ErdLayoutResult>
```

Internally split the layout pipeline into clearer phases:

1. `buildGraphIndex`
2. `classifyErdTables`
3. `assignHierarchicalRanks`
4. `orderRanksByRelationshipWeight`
5. `layoutHierarchicalComponent`
6. `wrapWideRanks`
7. `packComponents`
8. `resolveLayoutCollisions`

The existing collision and component packing stages remain the safety net. The main change is replacing the component-level snake grid with an ERD-specific hierarchical component layout.

## ERD Layout Semantics

### 1. Reference Direction

Treat `edge.source -> edge.target` as the primary relationship direction already used by the current graph index.

For acyclic components:

- Source-heavy tables receive lower ranks.
- Target-heavy/detail tables receive higher ranks.
- A relation chain should progress left-to-right by default.

For cyclic components:

- Collapse strongly connected cycles into rank groups.
- Keep cycle members near each other.
- Use original order and degree score for deterministic tie-breaking.

### 2. Hub Placement

Compute a hub score per table:

```ts
hubScore = incomingCount + outgoingCount + undirectedDegree
```

Use hub score to:

- Choose stable component anchors.
- Place heavily connected tables near the vertical center of their rank.
- Break ties before original index when doing rank ordering.

The goal is not to force every hub to the exact center of the whole diagram. The goal is to avoid important hub tables being stranded at rank edges.

### 3. Table Role Classification

Classify tables by label/name patterns and graph shape:

- `hub`: high degree tables such as user, contract, site, org.
- `mapping`: labels containing `mapping`, `map`, `rel`, or many FK-like references.
- `detail`: labels ending in or containing `item`, `detail`, `attendee`, `participant`.
- `history`: labels containing `history`, `log`, `audit`.
- `leaf`: mostly incoming-only or isolated detail nodes.
- `regular`: default.

Classification is only a layout hint. It must not affect data or persistence.

Role behavior:

- Mapping tables should sit between or near the referenced ranks.
- Detail/history/leaf tables should stay near their parent hub.
- Regular tables follow rank ordering.

### 4. Rank Ordering

Within each rank, order nodes by barycenter against connected nodes in adjacent ranks:

1. Initialize order by hub score descending, then original index.
2. Sweep left-to-right using average neighbor order from previous rank.
3. Sweep right-to-left using average neighbor order from next rank.
4. Repeat a small fixed number of times, for example 2 passes.

This should reduce obvious crossing without adding nondeterministic force simulation.

### 5. Rank Wrapping

Very large ranks should not become a long vertical or horizontal strip.

For each rank:

- Calculate rank width using measured node sizes.
- If a rank exceeds target component width, wrap it into rank lanes.
- Keep wrapped lanes adjacent to preserve the rank's semantic layer.

This means a component can look like:

```text
rank 0        rank 1 lane 0       rank 2
rank 0        rank 1 lane 1       rank 2
```

rather than becoming a single huge column.

### 6. Collision Safety

Keep the existing measured-size model and final collision pass.

The final pass should remain conservative:

- It can move nodes rightward within the same row/lane.
- It should not reorder ranks.
- It should not break the parent-child progression.

If collision resolution must move too many nodes, tests should reveal it through aspect ratio and rank progression checks.

## Data Flow

1. Toolbar calls `applyErdLayout(nodes, edges)`.
2. Layout computes component layouts with hierarchical ERD semantics.
3. Components are packed into a bounded rectangle.
4. Collision safety pass runs.
5. `ERDCanvas` commits final positions through `useDiagramErdApplyActions().applyLayout`.
6. `commitErdLayoutNodes` writes document move commands and calls canvas fallback.
7. Edge handles are normalized through the existing layout origin.

## Error Handling

- If graph analysis fails, return `{ nodes, status: 'failed' }`.
- If a component cannot be ranked, fall back to the current snake grid for that component only.
- If final layout fails, preserve original positions.
- The toolbar should keep the existing failure toast behavior.

## Testing Strategy

Unit tests in `client/test/unit/erd-auto-layout.test.ts` should cover:

- Simple chain progresses left-to-right.
- Branching parent table stays before child tables.
- Hub table is placed near the center of its component rank.
- Mapping table stays between or near referenced tables.
- Detail/history tables stay near their parent.
- Cyclic component still produces deterministic non-overlapping layout.
- Wide rank wraps instead of creating a long strip.
- Existing no-overlap tests remain.
- Existing aspect ratio tests remain.

Commit helper tests in `client/test/unit/erd-layout-commit.test.ts` should remain unchanged unless the persistence interface changes, which this design does not require.

Browser verification should use the existing GH 도급 ERD flow:

- Login with the QA account.
- Open `http://127.0.0.1:4503/teams/1/projects/2/diagrams/10`.
- Wait until the `자동 정렬` button is visible, not only until preview nodes are rendered.
- Click `자동 정렬`.
- Verify node count, edge count, overlap count, aspect ratio, and reload persistence.
- Add a lightweight relationship-quality report:
  - percentage of edges whose target is to the right of source,
  - approximate crossing count between visible node centers,
  - average distance from detail/mapping tables to connected hubs.

## Acceptance Criteria

- Auto layout still has zero visual overlap on the GH 도급 ERD after click and after reload.
- Overall shape stays a reasonable rectangle; target aspect score should remain below 2.4 in tests.
- Simple FK chains progress left-to-right.
- Branching parent-child fixtures place parent before children.
- Mapping/detail/history fixtures stay near related parent/hub nodes.
- Cyclic fixtures are deterministic and non-overlapping.
- `npm run test:unit -- erd-auto-layout erd-layout-commit` passes.
- `npx tsc --noEmit --pretty false` passes.
- `npm run build` passes.
- Browser QA records the GH 도급 metrics before final completion.

## Risks

- Real edge direction may not always mean parent-to-child. If data proves the opposite, rank assignment must support direction inversion without changing the public API.
- Name-based role classification is heuristic. It must be a weak tie-breaker, not the primary source of layout truth.
- Barycenter ordering can improve crossings but will not eliminate all crossings.
- Preserving no-overlap may sometimes reduce ERD aesthetics for very dense components. In this iteration, no-overlap wins.

## Implementation Notes

- Prefer small internal helper functions in `auto-layout.ts` first.
- If the file becomes hard to reason about, split helpers into `client/src/lib/erd-layout-graph.ts` and `client/src/lib/erd-layout-geometry.ts`.
- Avoid adding new dependencies.
- Keep the public `applyErdLayout` contract stable.
- Keep the existing collision resolution pass as the last stage.
