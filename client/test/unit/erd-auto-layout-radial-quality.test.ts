import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Node } from '@xyflow/react';
import type { TableNodeData } from '../../src/types/erd.js';
import type { PositionBatch } from '../../src/collaboration/plugins/erd/erd-position-batch.js';
import { applyErdLayout, ERD_AUTO_LAYOUT_CALLER_STRATEGY } from '../../src/lib/auto-layout.js';
import { commitErdLayoutNodes } from '../../src/lib/erd-layout-commit.js';
import { measureLayoutMetrics, type LayoutMetrics } from '../../src/lib/auto-layout-metrics.js';
import {
  buildLayoutGraph,
  findConnectedComponents,
  selectHub,
} from '../../src/lib/auto-layout-radial.js';
import {
  buildChain,
  buildDegenerateGraph,
  buildExtremeSizeGraph,
  buildIsolatedGroups,
  buildMesh,
  buildMultiHub,
  buildStar,
  buildTree,
  toMetricBoxes,
  type TestGraph,
} from '../fixtures/erd-auto-layout-graphs.js';
import { buildAnonymizedRealDiagram } from '../fixtures/erd-auto-layout-real-diagram.js';

/** 실데이터 수용 기준: 종횡비 상한 */
const MAX_ASPECT_RATIO = 1.3;
/** 실데이터 수용 기준: 원 채움률 하한 */
const MIN_CIRCLE_FILL = 0.4;
/** 실데이터 수용 기준: 윤곽 원형도 하한 */
const MIN_HULL_CIRCULARITY = 0.8;
/** 실데이터 수용 기준: 주허브 중심 이탈 상한 */
const MAX_HUB_OFFSET_RATIO = 0.2;
/** 실데이터 수용 기준: 평균 엣지 길이가 legacy 대비 넘지 말아야 하는 비율 */
const MAX_EDGE_LENGTH_RATIO = 0.9;

/**
 * 전략을 지정해 자동정렬하고 품질 지표를 계산한다.
 *
 * @param graph 테스트 그래프
 * @param strategy 배치 전략
 * @param hubId 허브 중심성을 평가할 노드 id
 * @returns 정렬된 노드와 지표
 */
async function layoutAndMeasure(
  graph: TestGraph,
  strategy: 'legacy' | 'radial',
  hubId?: string,
): Promise<{ nodes: Node<TableNodeData>[]; metrics: LayoutMetrics }> {
  const result = await applyErdLayout(graph.nodes, graph.edges, { strategy });
  assert.equal(result.status, 'applied');
  return {
    nodes: result.nodes,
    metrics: measureLayoutMetrics(toMetricBoxes(result.nodes), graph.edges, hubId),
  };
}

/**
 * 가장 큰 연결 성분의 허브(메인 테이블) id를 구한다.
 *
 * @param graph 테스트 그래프
 * @returns 주허브 id
 */
function mainHubOf(graph: TestGraph): string {
  const layoutGraph = buildLayoutGraph(
    graph.nodes.map((node) => node.id),
    graph.edges.map((edge) => ({ source: edge.source, target: edge.target })),
  );
  return selectHub(findConnectedComponents(layoutGraph)[0], layoutGraph);
}

test('radial: real 37-table diagram meets every acceptance metric and beats legacy edge length', async () => {
  const graph = buildAnonymizedRealDiagram();
  const hubId = mainHubOf(graph);

  const legacy = await layoutAndMeasure(graph, 'legacy', hubId);
  const radial = await layoutAndMeasure(graph, 'radial', hubId);

  assert.ok(radial.metrics.aspectRatio <= MAX_ASPECT_RATIO, `aspect ${radial.metrics.aspectRatio}`);
  assert.ok(radial.metrics.circleFill >= MIN_CIRCLE_FILL, `fill ${radial.metrics.circleFill}`);
  assert.ok(
    radial.metrics.hullCircularity >= MIN_HULL_CIRCULARITY,
    `circularity ${radial.metrics.hullCircularity}`,
  );
  assert.ok(
    radial.metrics.hubOffsetRatio !== null && radial.metrics.hubOffsetRatio <= MAX_HUB_OFFSET_RATIO,
    `hub offset ${radial.metrics.hubOffsetRatio}`,
  );
  assert.equal(radial.metrics.overlapArea, 0);
  assert.ok(
    radial.metrics.averageEdgeLength <= legacy.metrics.averageEdgeLength * MAX_EDGE_LENGTH_RATIO,
    `avg edge ${radial.metrics.averageEdgeLength} vs legacy ${legacy.metrics.averageEdgeLength}`,
  );
  assert.ok(radial.metrics.maxEdgeLength <= legacy.metrics.maxEdgeLength);
  assert.ok(radial.metrics.edgeCrossings <= legacy.metrics.edgeCrossings);
});

test('radial: each connected component of the real diagram keeps its hub near the component center', async () => {
  const graph = buildAnonymizedRealDiagram();
  const { nodes } = await layoutAndMeasure(graph, 'radial');
  const boxes = toMetricBoxes(nodes);
  const links = graph.edges.map((edge) => ({ source: edge.source, target: edge.target }));
  const layoutGraph = buildLayoutGraph(
    nodes.map((node) => node.id),
    links,
  );

  findConnectedComponents(layoutGraph)
    .filter((component) => component.length > 1)
    .forEach((component) => {
      const members = new Set(component);
      const metrics = measureLayoutMetrics(
        boxes.filter((box) => members.has(box.id)),
        links,
        selectHub(component, layoutGraph),
      );
      assert.ok(
        metrics.hubOffsetRatio !== null && metrics.hubOffsetRatio <= MAX_HUB_OFFSET_RATIO,
        `component of ${component.length}: hub offset ${metrics.hubOffsetRatio}`,
      );
    });
});

test('radial: linked tables stay grouped closer than the average table pair', async () => {
  const graph = buildAnonymizedRealDiagram();
  const { nodes, metrics } = await layoutAndMeasure(graph, 'radial');
  const boxes = toMetricBoxes(nodes);
  let pairDistanceSum = 0;
  let pairCount = 0;
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      pairDistanceSum += Math.hypot(
        boxes[left].x + boxes[left].width / 2 - boxes[right].x - boxes[right].width / 2,
        boxes[left].y + boxes[left].height / 2 - boxes[right].y - boxes[right].height / 2,
      );
      pairCount += 1;
    }
  }

  assert.ok(metrics.averageEdgeLength < (pairDistanceSum / pairCount) * 0.6);
});

/** 합성 그래프별 회귀 한계 (수용 기준이 아니라 퇴행 방지용 느슨한 상한) */
const SYNTHETIC_CASES: Array<{
  name: string;
  build: () => TestGraph;
  maxAspect: number;
  minFill: number;
  maxHubOffset?: number;
}> = [
  {
    name: 'star of 30 leaves',
    build: () => buildStar(30),
    maxAspect: 1.3,
    minFill: 0.35,
    maxHubOffset: 0.2,
  },
  { name: 'chain of 18', build: () => buildChain(18), maxAspect: 2, minFill: 0.25 },
  {
    name: 'balanced tree 3x3',
    build: () => buildTree(3, 3),
    maxAspect: 1.6,
    minFill: 0.3,
    maxHubOffset: 0.2,
  },
  { name: 'mesh 5x6', build: () => buildMesh(5, 6), maxAspect: 1.6, minFill: 0.25 },
  {
    name: 'groups with isolated tables',
    build: () => buildIsolatedGroups([8, 5, 3], 12),
    maxAspect: 1.6,
    minFill: 0.2,
  },
  { name: 'multiple hubs', build: () => buildMultiHub(3, 6), maxAspect: 1.6, minFill: 0.3 },
];

for (const { name, build, maxAspect, minFill, maxHubOffset } of SYNTHETIC_CASES) {
  test(`radial: ${name} stays compact, round and overlap free`, async () => {
    const graph = build();

    const { metrics } = await layoutAndMeasure(graph, 'radial', mainHubOf(graph));

    assert.equal(metrics.overlapArea, 0);
    assert.ok(metrics.aspectRatio <= maxAspect, `aspect ${metrics.aspectRatio}`);
    assert.ok(metrics.circleFill >= minFill, `fill ${metrics.circleFill}`);
    if (maxHubOffset !== undefined) {
      assert.ok(
        metrics.hubOffsetRatio !== null && metrics.hubOffsetRatio <= maxHubOffset,
        `hub offset ${metrics.hubOffsetRatio}`,
      );
    }
  });
}

test('radial: degenerate and extreme-size graphs apply without overlap or non-finite coordinates', async () => {
  for (const build of [buildDegenerateGraph, buildExtremeSizeGraph]) {
    const graph = build();
    const { nodes, metrics } = await layoutAndMeasure(graph, 'radial');

    assert.equal(metrics.overlapArea, 0);
    nodes.forEach((node) => {
      assert.ok(Number.isFinite(node.position.x) && Number.isFinite(node.position.y));
    });
  }
});

test('radial: applyErdLayout keeps input untouched, node order, ids and data identity', async () => {
  const graph = buildAnonymizedRealDiagram();
  const before = JSON.stringify(graph);

  const result = await applyErdLayout(graph.nodes, graph.edges, { strategy: 'radial' });

  assert.equal(JSON.stringify(graph), before);
  assert.deepEqual(
    result.nodes.map((node) => node.id),
    graph.nodes.map((node) => node.id),
  );
  result.nodes.forEach((node, index) => {
    assert.equal(node.data, graph.nodes[index].data);
    assert.equal(node.type, graph.nodes[index].type);
  });
  assert.ok(result.nodes.some((node) => node.position.x !== 0 || node.position.y !== 0));
});

test('radial: targetAspect is honored as an elliptical goal when explicitly given', async () => {
  const graph = buildIsolatedGroups([10, 6, 4], 20);

  const wide = await applyErdLayout(graph.nodes, graph.edges, {
    strategy: 'radial',
    targetAspect: 2,
  });
  const boxes = toMetricBoxes(wide.nodes);
  const width =
    Math.max(...boxes.map((box) => box.x + box.width)) - Math.min(...boxes.map((box) => box.x));
  const height =
    Math.max(...boxes.map((box) => box.y + box.height)) - Math.min(...boxes.map((box) => box.y));

  assert.ok(width / height > 1.4, `W/H ${width / height}`);
});

test('strategy defaults to legacy so existing callers keep the previous layout', async () => {
  const graph = buildAnonymizedRealDiagram();

  const implicit = await applyErdLayout(graph.nodes, graph.edges);
  const explicit = await applyErdLayout(graph.nodes, graph.edges, { strategy: 'legacy' });

  assert.deepEqual(
    implicit.nodes.map((node) => node.position),
    explicit.nodes.map((node) => node.position),
  );
  assert.ok(['legacy', 'radial'].includes(ERD_AUTO_LAYOUT_CALLER_STRATEGY));
});

test('radial: empty graph and failure-free single node', async () => {
  assert.deepEqual(await applyErdLayout([], [], { strategy: 'radial' }), {
    nodes: [],
    status: 'applied',
  });

  const graph = buildStar(0);
  const result = await applyErdLayout(graph.nodes, graph.edges, { strategy: 'radial' });
  assert.equal(result.status, 'applied');
  assert.equal(result.nodes.length, 1);
});

test('radial result commits as exactly one position batch anchored at the pre-layout coordinates', async () => {
  const graph = buildAnonymizedRealDiagram();
  const startNodes = graph.nodes.map((node, index) => ({
    ...node,
    position: { x: index * 7, y: index * 3 },
  }));
  const startSnapshot = JSON.stringify(startNodes.map((node) => node.position));
  const batches: PositionBatch[] = [];

  const result = await applyErdLayout(startNodes, graph.edges, { strategy: 'radial' });
  const status = commitErdLayoutNodes(
    result.nodes,
    startNodes,
    {
      available: true,
      applyLayout: (batch) => {
        batches.push(batch);
        return 'applied';
      },
    },
    () => assert.fail('unexpected rejection'),
  );

  assert.equal(status, 'applied');
  assert.equal(batches.length, 1);
  assert.equal(JSON.stringify(startNodes.map((node) => node.position)), startSnapshot);
  assert.equal(batches[0].entries.length, startNodes.length);
  batches[0].entries.forEach((entry, index) => {
    assert.deepEqual(entry.from, startNodes[index].position);
    assert.deepEqual(entry.to, result.nodes[index].position);
  });
});
