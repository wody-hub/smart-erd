# ERD ELK Auto Layout Design

## Purpose

Smart ERD's current auto layout uses Dagre directly. Users report three layout quality problems:

- Tables can overlap after auto layout.
- Relationship structure is not respected strongly enough.
- Diagrams can stretch into a long left-to-right strip instead of a usable rectangular shape.

This design replaces the persisted ERD auto layout engine with an ELK-based layout pipeline while preserving the existing React Flow canvas, Yjs persistence, collaboration, undo/redo origin handling, and toolbar entry point.

## Goals

- Prevent table overlap using dimensions that match the rendered table UI.
- Preserve ERD reference direction better than the current Dagre layout.
- Prefer balanced rectangular results over long horizontal strips.
- Keep the existing "자동 정렬" button behavior from the user's perspective.
- Keep full layout deterministic enough to test with fixture graphs.
- Fail safely by preserving existing node positions if layout calculation fails.

## Non-Goals

- Do not redesign edge rendering or manual edge waypoint editing.
- Do not add new user-facing layout settings in this iteration.
- Do not change group view editing rules.
- Do not rewrite preview canvas behavior unless required by shared layout helpers.
- Do not guarantee perfect square packing for every graph. The target is a substantially better aspect ratio with no overlap.

## Current System

The persisted ERD canvas currently calls `applyDagreLayout(nodes, edges)` from `ERDCanvas.handleAutoLayout`, then persists node positions through `applyLayout(layoutedNodes)`. After the position transaction, it normalizes edge handles with the `layout` reason and `USER_LAYOUT` origin.

The same full-layout helper is also used in the code/DDL apply path when the effective sync layout mode is `full`.

Key files:

- `client/src/components/erd/ERDCanvas.tsx`
- `client/src/lib/auto-layout.ts`
- `client/src/hooks/useApplyToErd.ts`
- `client/src/stores/canvas/canvasSyncActions.ts`
- `client/src/collaboration/plugins/erd/erd-document-mutation-applier.ts`

## Proposed Architecture

Introduce a new ELK layout pipeline in `client/src/lib/auto-layout.ts`:

- `applyErdLayout(nodes, edges, options?)`
  - Async public entry point used by persisted ERD full layout.
  - Builds an ELK graph from React Flow nodes and ERD edges.
  - Runs one or more ELK layout passes.
  - Converts ELK coordinates back to React Flow node positions.
  - Returns an `ErdLayoutResult` with original nodes and `status: 'failed'` if layout fails.

- `measureErdNode(node)`
  - Uses actual table dimensions, starting with width `420`.
  - Height uses current header, row, and footer constants.
  - This fixes the current mismatch where Dagre uses width `280` while table nodes render at `min-w-[420px]`.

- `runElkLayout(graph, direction)`
  - Runs ELK layered layout.
  - Supported directions in this iteration: `RIGHT` and `DOWN`.

- `selectBestLayout(candidates)`
  - Computes bounding boxes.
  - Prefers layouts with no overlap.
  - Chooses the candidate with the better aspect ratio score.
  - Aspect score is `max(width / height, height / width)`.

- `normalizeLayoutPositions(nodes)`
  - Shifts the final layout near the origin while preserving relative positions.

## ELK Configuration

Use `elkjs` with layered layout:

- `elk.algorithm`: `layered`
- `elk.direction`: `RIGHT` or `DOWN`
- `elk.spacing.nodeNode`: `80`
- `elk.layered.spacing.nodeNodeBetweenLayers`: `120`
- `elk.separateConnectedComponents`: `true`
- `elk.spacing.componentComponent`: `160`
- `elk.edgeRouting`: `ORTHOGONAL` or `POLYLINE`

The implementation should start with `ORTHOGONAL`. If it produces poor or unstable results in browser verification, switch to `POLYLINE` without changing the public API.

## Balanced Shape Strategy

The initial implementation will not manually pack components. Instead, it will run ELK twice for graphs where balanced shape matters:

1. Direction `RIGHT`.
2. Direction `DOWN`.

The selected result is the one with the better aspect ratio score. For large diagrams, the second pass may be skipped to control latency.

Initial large graph threshold:

- If node count is greater than `150`, run only the default `RIGHT` pass.

This keeps behavior predictable and avoids introducing a costly layout operation for very large diagrams. The threshold can be tuned after browser QA.

## Async Flow Changes

`elk.layout()` is Promise-based, so callers that currently expect sync layout must become async.

Persisted ERD toolbar:

- `handleAutoLayout` becomes async.
- It awaits `applyErdLayout(nodes, edges)`.
- It persists positions with existing `applyLayout(layoutedNodes)`.
- It keeps the existing `requestAnimationFrame` edge handle normalization.
- If layout fails and original nodes are returned, it should not crash. A toast may report failure if the helper exposes an error state.

Code/DDL apply path:

- `executeLayoutPhase` becomes async or delegates to an async layout branch.
- Full layout awaits `applyErdLayout`.
- Incremental layout remains synchronous in this implementation.
- Metrics should still record effective layout mode and duration.

## Error Handling

The layout helper must catch ELK errors and return the original nodes. This prevents the canvas from becoming unusable because of a bad graph, invalid ELK output, or runtime dependency failure.

The first implementation will use a result object so callers can distinguish a successful layout from a safe fallback:

```ts
type ErdLayoutResult = {
  nodes: Node<TableNodeData>[];
  status: 'applied' | 'failed';
};
```

The persisted ERD toolbar should show a toast when `status` is `failed`. The code/DDL apply path should preserve existing positions and record the failed layout status in metrics or a warning log without blocking the apply operation.

## Testing Strategy

Add unit tests for the layout helper before implementation:

- It returns non-overlapping bounding boxes for a fixture with multiple wide table nodes.
- It keeps a simple chain `A -> B -> C` progressing in the selected layout direction.
- It avoids an extreme strip for a medium graph by selecting the better of `RIGHT` and `DOWN`.
- It returns the original nodes when the ELK adapter fails.

Update apply-flow tests:

- Full layout waits for the async layout result before persisting positions.
- Incremental layout remains unchanged.

Browser verification:

- Open an ERD with several related tables.
- Click "자동 정렬".
- Confirm tables do not overlap.
- Confirm related tables are visually grouped by references.
- Confirm the result is not an excessively long single row.
- Confirm undo/redo still treats layout as one layout operation.

## Migration and Compatibility

Existing saved diagram positions remain valid. The new algorithm only affects future auto layout executions or full layout operations during code/DDL apply.

The current `applyDagreLayout` name should either be replaced by `applyErdLayout` or kept as a compatibility wrapper during migration. New code should use `applyErdLayout`.

## Rollout

Implementation should be kept behind normal code paths without a user-visible feature flag. If ELK causes unacceptable performance on large diagrams, add a node-count guard that preserves current positions or falls back to a single-pass ELK layout.

## Acceptance Criteria

- `elkjs` is added as a frontend dependency.
- Persisted ERD auto layout uses ELK instead of Dagre.
- Full layout in code/DDL apply awaits the async layout result.
- Tests cover overlap prevention, reference direction, aspect-ratio selection, and fallback.
- `npm run test:unit` passes.
- `npm run build` passes.
- Browser QA confirms the "자동 정렬" button produces a non-overlapping, relationship-aware, reasonably rectangular layout.
