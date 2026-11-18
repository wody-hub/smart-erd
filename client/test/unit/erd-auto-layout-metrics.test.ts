import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyErdLayout } from '../../src/lib/auto-layout.js';
import {
  computeConvexHull,
  computeMinimumEnclosingCircle,
  computeOverlapArea,
  countEdgeCrossings,
  measureLayoutMetrics,
  type MetricBox,
} from '../../src/lib/auto-layout-metrics.js';
import { buildAnonymizedRealDiagram } from '../fixtures/erd-auto-layout-real-diagram.js';
import { toMetricBoxes } from '../fixtures/erd-auto-layout-graphs.js';

/** 부동소수 비교 허용 오차 */
const TOLERANCE = 1e-6;

test('computeMinimumEnclosingCircle encloses a square by its half diagonal', () => {
  const circle = computeMinimumEnclosingCircle([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
    { x: 10, y: 10 },
    { x: 5, y: 5 },
  ]);

  assert.ok(Math.abs(circle.radius - Math.hypot(5, 5)) < TOLERANCE);
  assert.ok(Math.abs(circle.x - 5) < TOLERANCE && Math.abs(circle.y - 5) < TOLERANCE);
});

test('computeConvexHull drops interior and collinear points', () => {
  const hull = computeConvexHull([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
  ]);

  assert.equal(hull.length, 4);
});

test('computeOverlapArea measures intersection and ignores touching boxes', () => {
  const base: MetricBox = { id: 'a', x: 0, y: 0, width: 10, height: 10 };

  assert.equal(computeOverlapArea(base, { id: 'b', x: 5, y: 5, width: 10, height: 10 }), 25);
  assert.equal(computeOverlapArea(base, { id: 'c', x: 10, y: 0, width: 10, height: 10 }), 0);
});

test('measureLayoutMetrics reports aspect, fill, hub offset and edge lengths for a known layout', () => {
  const boxes: MetricBox[] = [
    { id: 'hub', x: 40, y: 40, width: 20, height: 20 },
    { id: 'left', x: 0, y: 40, width: 20, height: 20 },
    { id: 'right', x: 80, y: 40, width: 20, height: 20 },
  ];
  const metrics = measureLayoutMetrics(
    boxes,
    [
      { source: 'hub', target: 'left' },
      { source: 'hub', target: 'right' },
      { source: 'right', target: 'hub' },
      { source: 'hub', target: 'hub' },
    ],
    'hub',
  );

  assert.ok(Math.abs(metrics.aspectRatio - 5) < TOLERANCE);
  assert.equal(metrics.overlapArea, 0);
  assert.ok(metrics.hubOffsetRatio !== null && metrics.hubOffsetRatio < TOLERANCE);
  assert.ok(Math.abs(metrics.averageEdgeLength - 40) < TOLERANCE);
  assert.ok(Math.abs(metrics.maxEdgeLength - 40) < TOLERANCE);
  assert.ok(metrics.circleFill > 0 && metrics.circleFill < 1);
});

test('legacy auto layout baseline on the anonymized real diagram is measurable and overlap-free', async () => {
  const { nodes, edges } = buildAnonymizedRealDiagram();

  const result = await applyErdLayout(nodes, edges);
  const metrics = measureLayoutMetrics(toMetricBoxes(result.nodes), edges);

  assert.equal(nodes.length, 37);
  assert.equal(edges.length, 27);
  assert.equal(metrics.overlapArea, 0);
  assert.ok(metrics.aspectRatio > 1 && Number.isFinite(metrics.aspectRatio));
  assert.ok(metrics.circleFill > 0 && metrics.circleFill < 0.3);
});

test('countEdgeCrossings counts proper crossings and skips pairs sharing an endpoint', () => {
  const corner = (id: string, x: number, y: number): MetricBox => ({
    id,
    x,
    y,
    width: 2,
    height: 2,
  });
  const a = corner('a', 0, 0);
  const b = corner('b', 10, 10);
  const c = corner('c', 0, 10);
  const d = corner('d', 10, 0);
  const e = corner('e', 20, 20);

  assert.equal(
    countEdgeCrossings([
      [a, b],
      [c, d],
    ]),
    1,
  );
  assert.equal(
    countEdgeCrossings([
      [a, b],
      [b, e],
    ]),
    0,
  );
});
