import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { performance } from 'node:perf_hooks';
import {
  buildObstacleAvoidingAutoRoute,
  getCachedEdgeObstacleRects,
  type EdgeObstacleRect,
} from '../../src/components/erd/edgeAutoRoute.js';
import type {
  BuildStraightEdgePointsInput,
  EdgePoint,
} from '../../src/components/erd/edgeWaypointGeometry.js';

const OBSTACLE_PADDING = 20;
const OUTER_CORRIDOR_MARGIN = 48;

/**
 * Makes a horizontal edge with marker-adjusted anchors at 0 and 600.
 * @param overrides Input fields to replace.
 * @returns A routing input with default marker offsets.
 */
function edgeInput(
  overrides: Partial<BuildStraightEdgePointsInput> = {},
): BuildStraightEdgePointsInput {
  return {
    sourceX: -12,
    sourceY: 0,
    targetX: 614,
    targetY: 0,
    sourceDirection: 1,
    targetDirection: -1,
    sourceMarkerOffset: 12,
    targetMarkerOffset: 14,
    waypoints: [],
    ...overrides,
  };
}

/**
 * Makes a table node with explicit geometry.
 * @param id Stable node identifier.
 * @param x Left coordinate.
 * @param y Top coordinate.
 * @param width Measured width.
 * @param height Measured height.
 * @returns A table node snapshot.
 */
function tableNode(id: string, x: number, y: number, width = 80, height = 60) {
  return { id, type: 'table', position: { x, y }, measured: { width, height } };
}

test('clear-route cache avoids rereading unchanged snapshot geometry', () => {
  const nodes = [tableNode('far', 10000, 10000)];
  const rects = getCachedEdgeObstacleRects(nodes, 'cache-source', 'cache-target');
  const rect = rects[0];
  let reads = 0;
  for (const key of ['left', 'right', 'top', 'bottom'] as const) {
    const value = rect[key];
    Object.defineProperty(rect, key, {
      /**
       * Returns the original coordinate and counts geometry work.
       * @returns Original coordinate value.
       */
      get() {
        reads += 1;
        return value;
      },
    });
  }
  assert.equal(buildObstacleAvoidingAutoRoute(edgeInput(), rects), null);
  reads = 0;
  assert.equal(buildObstacleAvoidingAutoRoute(edgeInput(), rects), null);
  assert.equal(reads, 0, 'a proven clear route should bypass geometry reads');
});

/**
 * Returns a reproducible xorshift32 generator.
 * @param seed Initial generator state.
 * @returns A deterministic unit interval generator.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/**
 * Compares values and serialized point bytes with the frozen implementation.
 * @param input Routing anchors.
 * @param rects Obstacles in candidate enumeration order.
 * @returns The production route after both comparisons pass.
 */
function assertReference(input: BuildStraightEdgePointsInput, rects: EdgeObstacleRect[]) {
  const expected = referenceAutoRoute(input, rects);
  const actual = buildObstacleAvoidingAutoRoute(input, rects);
  assert.deepEqual(actual, expected);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
  return actual;
}

test('seeded geometry and node mutation sequences preserve reference point bytes', (t) => {
  const random = seededRandom(0x5eed0123);
  let clear = 0;
  let detours = 0;
  let blocked = 0;
  for (let scenario = 0; scenario < 180; scenario += 1) {
    const count = 8 + Math.floor(random() * 40);
    let nodes = Array.from({ length: count }, (_, index) =>
      tableNode(
        `node-${scenario}-${index}`,
        70 + Math.floor(random() * 450),
        scenario % 3 === 0 ? 500 + Math.floor(random() * 400) : -250 + Math.floor(random() * 500),
        5 + Math.floor(random() * 75),
        5 + Math.floor(random() * 90),
      ),
    );
    nodes.push(
      tableNode(`source-${scenario}`, -100, -50),
      tableNode(`target-${scenario}`, 600, -50),
    );
    if (scenario % 3 === 1) nodes.push(tableNode(`forced-${scenario}`, 250, -30, 60, 60));
    if (scenario % 3 === 2) nodes.push(tableNode(`forced-${scenario}`, -10, -10, 20, 20));
    let input = edgeInput();
    for (let step = 0; step < 12; step += 1) {
      const rects = getCachedEdgeObstacleRects(nodes, `source-${scenario}`, `target-${scenario}`);
      const result = assertReference(input, rects);
      // Also exercise the backward-compatible plain mutable array API and its spatial index.
      assertReference(
        input,
        rects.map((rect) => ({ ...rect })),
      );
      if (result) detours += 1;
      else if (
        !routeIntersectsObstacles(
          defaultReferencePoints(input),
          rects,
          rects.map((rect) => expandObstacle(rect, 20)),
        )
      )
        clear += 1;
      else blocked += 1;
      const selected = Math.floor(random() * nodes.length);
      if (step === 4) {
        nodes = [...nodes, tableNode(`added-${scenario}`, 100, -15, 20, 30)];
      } else if (step === 5) {
        nodes = nodes.filter((node) => node.id !== `added-${scenario}`);
      } else if (step === 6) {
        nodes = [...nodes].reverse();
      } else {
        nodes = nodes.map((node, index) =>
          index === selected
            ? {
                ...node,
                type: step === 8 ? 'group' : step === 9 ? 'previewTable' : node.type,
                position: {
                  x: node.position.x + Math.floor(random() * 101) - 50,
                  y: node.position.y + Math.floor(random() * 81) - 40,
                },
                measured: {
                  width: 5 + Math.floor(random() * 160),
                  height: 5 + Math.floor(random() * 120),
                },
              }
            : node,
        );
      }
      if (step === 7)
        input = edgeInput({
          sourceY: Math.floor(random() * 200) - 100,
          targetY: Math.floor(random() * 200) - 100,
          sourceDirection: random() < 0.5 ? -1 : 1,
          targetDirection: random() < 0.5 ? -1 : 1,
          sourceMarkerOffset: Math.floor(random() * 30),
          targetMarkerOffset: Math.floor(random() * 30),
        });
    }
  }
  assert.ok(clear > 400, `insufficient clear defaults: ${clear}`);
  assert.ok(detours > 400, `insufficient detours: ${detours}`);
  assert.ok(blocked > 100, `insufficient blocked defaults: ${blocked}`);
  t.diagnostic(
    `seed=0x5eed0123; 2160 snapshot + 2160 plain-array comparisons; clear=${clear}, detour=${detours}, blocked=${blocked}`,
  );
});

/**
 * Reconstructs the exact pre-P1 default polyline for coverage classification.
 * @param input Routing anchors.
 * @returns The compacted default polyline.
 */
function defaultReferencePoints(input: BuildStraightEdgePointsInput): EdgePoint[] {
  const source = {
    x: input.sourceX + input.sourceDirection * input.sourceMarkerOffset,
    y: input.sourceY,
  };
  const target = {
    x: input.targetX + input.targetDirection * input.targetMarkerOffset,
    y: input.targetY,
  };
  return compactOrthogonalPoints([
    source,
    { x: (source.x + target.x) / 2, y: source.y },
    { x: (source.x + target.x) / 2, y: target.y },
    target,
  ]);
}

test('clear proofs invalidate on additions, deletions, skipped snapshots and changed anchors', () => {
  const source = 'sequence-source';
  const target = 'sequence-target';
  let nodes = [
    tableNode(source, -80, -20),
    tableNode(target, 600, -20),
    tableNode('moving', 200, 800),
  ];
  assert.equal(
    assertReference(edgeInput(), getCachedEdgeObstacleRects(nodes, source, target)),
    null,
  );
  // A far-away resize and an endpoint resize leave the proof valid.
  nodes = nodes.map((node) => ({ ...node, measured: { width: 100, height: 100 } }));
  assert.equal(
    assertReference(edgeInput(), getCachedEdgeObstacleRects(nodes, source, target)),
    null,
  );
  nodes = [...nodes, tableNode('blocker', 250, -30, 50, 60)];
  assert.ok(assertReference(edgeInput(), getCachedEdgeObstacleRects(nodes, source, target)));
  nodes = nodes.filter((node) => node.id !== 'blocker');
  assert.equal(
    assertReference(edgeInput(), getCachedEdgeObstacleRects(nodes, source, target)),
    null,
  );
  // These two snapshots are never routed: compare the last proof to the actual current geometry.
  getCachedEdgeObstacleRects([...nodes, tableNode('skipped', 100, 900)], source, target);
  nodes = nodes.map((node) =>
    node.id === 'moving' ? tableNode('moving', 250, -30, 50, 60) : node,
  );
  assert.ok(assertReference(edgeInput(), getCachedEdgeObstacleRects(nodes, source, target)));
  assertReference(
    edgeInput({ sourceY: 300, targetY: 400 }),
    getCachedEdgeObstacleRects(nodes, source, target),
  );
});

test('incremental invalidation preserves middle padding, terminal raw rectangles and endpoint exclusion', () => {
  const source = 'padding-source';
  const target = 'padding-target';
  const input = edgeInput({ targetY: 200 });
  let nodes = [
    tableNode(source, 0, -100),
    tableNode(target, 600, 100),
    tableNode('remote', 2000, 2000),
  ];
  assert.equal(assertReference(input, getCachedEdgeObstacleRects(nodes, source, target)), null);
  // Only the expanded rectangle crosses the middle x=300 segment.
  nodes = [...nodes, tableNode('padding-blocker', 310, 90, 20, 20)];
  assert.ok(assertReference(input, getCachedEdgeObstacleRects(nodes, source, target)));
  nodes = nodes.filter((node) => node.id !== 'padding-blocker');
  assert.equal(assertReference(input, getCachedEdgeObstacleRects(nodes, source, target)), null);
  // Padding crosses the first segment, but its raw rectangle does not: preserve null.
  nodes = [...nodes, tableNode('terminal-neighbor', 30, 10, 20, 10)];
  assert.equal(assertReference(input, getCachedEdgeObstacleRects(nodes, source, target)), null);
  // Endpoint rectangles may engulf the default route and are still excluded at query time.
  nodes = nodes.map((node) =>
    node.id === source ? tableNode(source, -1000, -1000, 3000, 3000) : node,
  );
  assert.equal(assertReference(input, getCachedEdgeObstacleRects(nodes, source, target)), null);
  // The same geometry used as a non-endpoint must be considered.
  assertReference(input, getCachedEdgeObstacleRects(nodes, 'another-source', target));
});

test('a null caused by no possible detour never becomes a clear proof', () => {
  let nodes = [tableNode('trap', -10, -10, 20, 20), tableNode('block', 250, -30, 50, 60)];
  const rects = getCachedEdgeObstacleRects(nodes, 'trapped-source', 'trapped-target');
  assert.equal(assertReference(edgeInput(), rects), null);
  nodes = nodes.filter((node) => node.id !== 'trap');
  assert.ok(
    assertReference(
      edgeInput(),
      getCachedEdgeObstacleRects(nodes, 'trapped-source', 'trapped-target'),
    ),
  );
});

test('boundary touching, degenerate segments, tie order and mutable arrays match reference', () => {
  for (const sourceY of [-20, 0, 20, 40]) {
    for (const targetX of [-12, 14, 300, 614]) {
      for (const targetY of [sourceY, 20, 40]) {
        const rects = [
          { left: 100, right: 200, top: 0, bottom: 20 },
          { left: 250, right: 350, top: -20, bottom: 40 },
        ];
        const input = edgeInput({ sourceY, targetX, targetY });
        assertReference(input, rects);
        rects.reverse();
        assertReference(input, rects);
        rects[0].top += 200;
        assertReference(input, rects);
      }
    }
  }
});

/**
 * Builds a sparse but nontrivial benchmark with O(N) distinct corridor coordinates.
 * @param size Number of table obstacles.
 * @returns Sparse obstacles with one mandatory blocker.
 */
function benchmarkNodes(size: number) {
  const nodes = [tableNode('bench-block', 280, -30, 40, 60)];
  for (let i = 1; i < size; i += 1) {
    nodes.push(
      tableNode(`bench-${i}`, 1000 + i * 13, 500 + (i % 17) * 90, 20 + (i % 7), 30 + (i % 11)),
    );
  }
  return nodes;
}

/**
 * Returns the median elapsed milliseconds after warming the same deterministic workload.
 * @param run Synchronous workload to time.
 * @returns Median of seven samples in milliseconds.
 */
function medianTiming(run: () => void): number {
  for (let i = 0; i < 3; i += 1) run();
  const samples: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b)[3];
}

test('unit benchmark reports N=200/500 cold snapshot routing and incremental clear routes', (t) => {
  for (const size of [200, 500]) {
    const nodes = benchmarkNodes(size);
    const rects = getCachedEdgeObstacleRects(nodes, 'bench-source', 'bench-target');
    const detourInput = edgeInput();
    assert.ok(assertReference(detourInput, rects));
    // Every call must evaluate all candidate corridors; detour routes are deliberately never cached.
    const calls = 30;
    const before = medianTiming(() => {
      for (let i = 0; i < calls; i += 1) referenceAutoRoute(detourInput, rects);
    });
    const after = medianTiming(() => {
      for (let i = 0; i < calls; i += 1) buildObstacleAvoidingAutoRoute(detourInput, rects);
    });
    // Vary one distant node per snapshot; 240 independent edges retain their clear defaults.
    const frames = Array.from({ length: 12 }, (_, frame) =>
      nodes.map((node, i) =>
        i === size - 1 ? { ...node, measured: { width: 40 + frame, height: 70 } } : node,
      ),
    );
    const inputs = Array.from({ length: 240 }, (_, i) =>
      edgeInput({ sourceY: -1000 - i * 2, targetY: -900 - i * 2 }),
    );
    const frameRects = frames.map((frame) =>
      getCachedEdgeObstacleRects(frame, 'bench-clear-source', 'bench-clear-target'),
    );
    for (const frame of frameRects) for (const input of inputs) assertReference(input, frame);
    const clearBefore = medianTiming(() => {
      for (const frame of frameRects) for (const input of inputs) referenceAutoRoute(input, frame);
    });
    const clearAfter = medianTiming(() => {
      for (const frame of frameRects)
        for (const input of inputs) buildObstacleAvoidingAutoRoute(input, frame);
    });
    // Includes geometry signature, array creation, index construction and routing for a fresh snapshot.
    let revision = 100;
    const fullSnapshot = medianTiming(() => {
      const fresh = nodes.map((node, i) =>
        i === size - 1 ? { ...node, measured: { width: revision++, height: 70 } } : node,
      );
      const obstacles = getCachedEdgeObstacleRects(fresh, 'bench-cold-source', 'bench-cold-target');
      buildObstacleAvoidingAutoRoute(detourInput, obstacles);
    });
    t.diagnostic(
      `N=${size}; detour ${calls} calls: reference=${before.toFixed(3)}ms indexed=${after.toFixed(3)}ms (${(before / after).toFixed(2)}x); clear ${12 * inputs.length} calls/12 resize snapshots: reference=${clearBefore.toFixed(3)}ms incremental=${clearAfter.toFixed(3)}ms (${(clearBefore / clearAfter).toFixed(2)}x); fresh snapshot+detour=${fullSnapshot.toFixed(3)}ms`,
    );
  }
});

test('spatial filtering reduces exact geometry reads for a mandatory detour', () => {
  const nodes = benchmarkNodes(200).map((node) => ({ ...node, id: `spatial-${node.id}` }));
  const rects = getCachedEdgeObstacleRects(nodes, 'spatial-source', 'spatial-target');
  let reads = 0;
  for (const rect of rects) {
    for (const key of ['left', 'right', 'top', 'bottom'] as const) {
      const value = rect[key];
      Object.defineProperty(rect, key, {
        /**
         * Counts raw geometry inspections without changing its value.
         * @returns The original coordinate.
         */
        get() {
          reads += 1;
          return value;
        },
      });
    }
  }
  const expected = referenceAutoRoute(edgeInput(), rects);
  const referenceReads = reads;
  reads = 0;
  const actual = buildObstacleAvoidingAutoRoute(edgeInput(), rects);
  assert.ok(actual);
  assert.deepEqual(actual, expected);
  assert.ok(reads < referenceReads / 2, `spatial=${reads}, reference=${referenceReads}`);
});

/**
 * Frozen pre-P1 reference: referenceAutoRoute.
 * @param input Routing anchors.
 * @param obstacles Raw obstacle rectangles.
 * @returns The exact original detour or null.
 */
function referenceAutoRoute(
  input: BuildStraightEdgePointsInput,
  obstacles: EdgeObstacleRect[],
): EdgePoint[] | null {
  if (obstacles.length === 0) {
    return null;
  }

  const expandedObstacles = obstacles.map((obstacle) => expandObstacle(obstacle, OBSTACLE_PADDING));
  const sourcePoint = {
    x: input.sourceX + input.sourceDirection * input.sourceMarkerOffset,
    y: input.sourceY,
  };
  const targetPoint = {
    x: input.targetX + input.targetDirection * input.targetMarkerOffset,
    y: input.targetY,
  };
  const defaultPoints = compactOrthogonalPoints([
    sourcePoint,
    { x: (sourcePoint.x + targetPoint.x) / 2, y: sourcePoint.y },
    { x: (sourcePoint.x + targetPoint.x) / 2, y: targetPoint.y },
    targetPoint,
  ]);

  if (!routeIntersectsObstacles(defaultPoints, obstacles, expandedObstacles)) {
    return null;
  }

  const xCandidates = new Set<number>([
    Math.min(sourcePoint.x, targetPoint.x) - OUTER_CORRIDOR_MARGIN,
    Math.max(sourcePoint.x, targetPoint.x) + OUTER_CORRIDOR_MARGIN,
  ]);
  const yCandidates = new Set<number>([
    Math.min(sourcePoint.y, targetPoint.y) - OUTER_CORRIDOR_MARGIN,
    Math.max(sourcePoint.y, targetPoint.y) + OUTER_CORRIDOR_MARGIN,
  ]);

  for (const obstacle of expandedObstacles) {
    xCandidates.add(obstacle.left - OUTER_CORRIDOR_MARGIN);
    xCandidates.add(obstacle.right + OUTER_CORRIDOR_MARGIN);
    yCandidates.add(obstacle.top - OUTER_CORRIDOR_MARGIN);
    yCandidates.add(obstacle.bottom + OUTER_CORRIDOR_MARGIN);
  }

  let bestRoute: EdgePoint[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const corridorX of xCandidates) {
    const candidate = compactOrthogonalPoints([
      sourcePoint,
      { x: corridorX, y: sourcePoint.y },
      { x: corridorX, y: targetPoint.y },
      targetPoint,
    ]);
    if (routeIntersectsObstacles(candidate, obstacles, expandedObstacles)) {
      continue;
    }
    const score = calculateRouteScore(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestRoute = candidate;
    }
  }

  for (const corridorY of yCandidates) {
    const candidate = compactOrthogonalPoints([
      sourcePoint,
      { x: sourcePoint.x, y: corridorY },
      { x: targetPoint.x, y: corridorY },
      targetPoint,
    ]);
    if (routeIntersectsObstacles(candidate, obstacles, expandedObstacles)) {
      continue;
    }
    const score = calculateRouteScore(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestRoute = candidate;
    }
  }

  return bestRoute;
}

/**
 * Frozen pre-P1 reference: expandObstacle.
 * @param obstacle Original rectangle.
 * @param padding Expansion distance.
 * @returns The original expanded rectangle.
 */
function expandObstacle(obstacle: EdgeObstacleRect, padding: number): EdgeObstacleRect {
  return {
    left: obstacle.left - padding,
    right: obstacle.right + padding,
    top: obstacle.top - padding,
    bottom: obstacle.bottom + padding,
  };
}

/**
 * Frozen pre-P1 reference: compactOrthogonalPoints.
 * @param points Original polyline.
 * @returns The original compacted points.
 */
function compactOrthogonalPoints(points: EdgePoint[]): EdgePoint[] {
  if (points.length <= 2) {
    return points;
  }

  const compacted: EdgePoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = compacted[compacted.length - 1];
    const current = points[index];
    const next = points[index + 1];
    const sharesVertical = previous.x === current.x && current.x === next.x;
    const sharesHorizontal = previous.y === current.y && current.y === next.y;

    if (sharesVertical || sharesHorizontal) {
      continue;
    }

    compacted.push(current);
  }

  compacted.push(points[points.length - 1]);
  return compacted;
}

/**
 * Frozen pre-P1 reference: routeIntersectsObstacles.
 * @param points Original candidate polyline.
 * @param rawObstacles Original raw rectangles.
 * @param expandedObstacles Original expanded rectangles.
 * @returns The original intersection result.
 */
function routeIntersectsObstacles(
  points: EdgePoint[],
  rawObstacles: EdgeObstacleRect[],
  expandedObstacles: EdgeObstacleRect[],
): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const obstacles = index === 0 || index === points.length - 2 ? rawObstacles : expandedObstacles;
    for (const obstacle of obstacles) {
      if (segmentIntersectsObstacle(start, end, obstacle)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Frozen pre-P1 reference: segmentIntersectsObstacle.
 * @param start Segment start.
 * @param end Segment end.
 * @param obstacle Rectangle to inspect.
 * @returns The original strict intersection result.
 */
function segmentIntersectsObstacle(
  start: EdgePoint,
  end: EdgePoint,
  obstacle: EdgeObstacleRect,
): boolean {
  if (start.x === end.x) {
    const x = start.x;
    if (x <= obstacle.left || x >= obstacle.right) {
      return false;
    }
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return maxY > obstacle.top && minY < obstacle.bottom;
  }

  const y = start.y;
  if (y <= obstacle.top || y >= obstacle.bottom) {
    return false;
  }
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  return maxX > obstacle.left && minX < obstacle.right;
}

/**
 * Frozen pre-P1 reference: calculateRouteScore.
 * @param points Original candidate polyline.
 * @returns The original length and bend score.
 */
function calculateRouteScore(points: EdgePoint[]): number {
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    totalLength +=
      Math.abs(points[index + 1].x - points[index].x) +
      Math.abs(points[index + 1].y - points[index].y);
  }
  return totalLength + (points.length - 2) * 12;
}
