# ERD Route Recalculation Reduction Implementation Plan

> **For agentic workers:** Execute this plan task by task. Preserve the existing performance probe and saved ERD benchmark artifacts.

**Goal:** Reduce redundant obstacle-avoiding edge route calculations while preserving route geometry and updates when tables or handles move.

**Architecture:** Keep the existing route algorithm and inputs. Add an equality function for the exact obstacle geometry consumed by the algorithm; pass it to ReactFlow's `useStore` subscription so unrelated store updates retain the prior obstacle-array identity. Existing `useMemo` then skips routing unless obstacle geometry, endpoints, or routing type changes. Measure a representative saved ERD before deciding whether to optimize the algorithm itself.

**Tech Stack:** ReactFlow Zustand store, React, TypeScript, Node test runner, Playwright/CDP performance probe.

## Constraints

- Preserve current edge paths for unchanged geometry, manual waypoints, drag behavior, and all routing types.
- No persisted schema or user-setting change. The diagnostic detour-off switch remains opt-in only.
- Do not edit or reset the uncommitted measurement work already present in the shared tree.
- Run the saved ERD browser benchmark against the isolated clone; source and clone row hashes must match before/after. Compare production frontend with test backend/auth using the same seed and sample count as the report. Keep raw traces outside the repository.

## Task 1: Geometry equality and behavior verification

**Files:** Modify `client/src/components/erd/edgeAutoRoute.ts` and `client/src/components/erd/ErdRelationEdge.tsx`; extend `client/test/unit/edge-auto-route.test.ts`.

**Interface:** Export `areEdgeObstacleRectsEqual(left: readonly EdgeObstacleRect[], right: readonly EdgeObstacleRect[]): boolean` from `edgeAutoRoute.ts`. It returns true only when corresponding `left/right/top/bottom` coordinates and array lengths are identical. Use it as ReactFlow `useStore` equality function for `obstacleRects`.

- [ ] Add a failing test: separately allocated but geometrically identical arrays compare equal. Verify it fails because the function does not exist.
- [ ] Add failing tests showing changed position/size, added or removed obstacle, and reordered distinct obstacles compare unequal. Verify expected failures.
- [ ] Implement the equality function without changing `buildObstacleAvoidingAutoRoute` semantics. Wire the ReactFlow selector's equality argument so unchanged arrays retain identity and the existing `useMemo` does not reroute.
- [ ] Run targeted route tests, TypeScript, ESLint, Prettier, and `git diff --check`. Confirm tests are behavior-oriented and exercise each coordinate dimension.

## Task 2: Saved ERD regression measurement

**Files:** Add a new sanitized report under `.gstack/benchmark-reports/`; do not overwrite the original attribution report.

- [ ] Verify the selected source row and clone-seed hashes, and recreate each run DB from the seed. Confirm API and direct WS target only the clone.
- [ ] Build the production frontend with the same probe settings, then run one warmup and five valid saved ERD baseline samples. Exclude fallback/errors with reasons. Keep viewport, browser, graph counts, and routing type constant.
- [ ] Compare route calls and aggregate route time, live-ready, live-settled, blocking excess, long-task count, and graph/preview/WS validity against the existing baseline distribution. Record raw values and median/min/max/IQR. The prior route-off condition is a diagnostic lower bound, not a target to claim automatically.
- [ ] Verify a meaningful edge-routing interaction: move a table or otherwise change obstacle geometry in an isolated clone and confirm routes update, while unchanged geometry does not trigger rerouting. Restore by dropping the run DB; compare source/seed hashes afterward. Capture before/after screenshots or route path data if available without leaking diagram content.
- [ ] If route calls fall sharply and paths remain correct, stop. If calls remain high, inspect which `useMemo` dependency changes and implement only the next proven optimization (shared expanded-obstacle cache or spatial filtering) with a new test and another targeted measurement.

## Review gate

Owner reviews the implementation diff and targeted tests before the benchmark; owner reviews validity and raw comparison before accepting an optimization claim. Report any remaining visual or statistical limits explicitly.

## Execution outcome (2026-10-13)

The geometry-equality subscription and its tests were implemented. A saved ERD production-frontend comparison completed one warmup and five valid independent runs. Median detour calls fell from 18,875 to 1,939 and live-settled time from 3,866.9 ms to 2,791.5 ms. The UI movement check was inconclusive, so browser-level route-update and pixel-equivalence claims remain open; the comparator's geometry invalidation cases passed unit tests. No second routing-algorithm change was made. Full results remain in a local, ignored benchmark report.
