import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  areEdgeRoutePointsEqual,
  createEdgeAutoRouteSelector,
  type EdgeAutoRouteInput,
} from '../../src/components/erd/edgeRenderSelectors.js';
import { buildObstacleAvoidingAutoRoute } from '../../src/components/erd/edgeAutoRoute.js';

/**
 * 마커 보정 후 끝점이 (0, 0), (600, 0)이 되는 입력을 만든다.
 * @param overrides 교체할 라우팅 입력
 * @returns 자동 경로 선택 입력
 */
function routeInput(overrides: Partial<EdgeAutoRouteInput> = {}): EdgeAutoRouteInput {
  return {
    sourceNodeId: 'source',
    targetNodeId: 'target',
    routingType: 'smoothstep',
    detourOff: false,
    sourceX: -12,
    sourceY: 0,
    targetX: 614,
    targetY: 0,
    sourceDirection: 1,
    targetDirection: -1,
    sourceMarkerOffset: 12,
    targetMarkerOffset: 14,
    ...overrides,
  };
}

/**
 * 명시적인 기하를 가진 테이블 스냅샷을 만든다.
 * @param id 노드 ID
 * @param x 왼쪽 좌표
 * @param y 위쪽 좌표
 * @param width 측정된 너비
 * @param height 측정된 높이
 * @returns 장애물 노드
 */
function tableNode(id: string, x: number, y: number, width = 80, height = 60) {
  return { id, type: 'table', position: { x, y }, measured: { width, height } };
}

test('route selector returns exact marker-adjusted detour points and excludes endpoints', () => {
  const selector = createEdgeAutoRouteSelector(routeInput());
  const points = selector({
    nodes: [
      tableNode('source', -30, -30),
      tableNode('blocker', 250, -30, 60, 60),
      tableNode('target', 580, -30),
    ],
  });
  assert.deepEqual(points, [
    { x: 0, y: 0 },
    { x: 0, y: -98 },
    { x: 600, y: -98 },
    { x: 600, y: 0 },
  ]);
});

test('route selector preserves a non-null route reference after an unrelated node resize', () => {
  const selector = createEdgeAutoRouteSelector(routeInput());
  const blocker = tableNode('blocker', 250, -30, 60, 60);
  const far = tableNode('far', 10000, 10000);
  const first = selector({ nodes: [blocker, far] });
  assert.ok(first);
  const resized = selector({
    nodes: [blocker, { ...far, measured: { width: 140, height: 100 } }],
  });
  assert.equal(resized, first);
});

test('route selector returns a new reference when a resize changes the winning route', () => {
  const selector = createEdgeAutoRouteSelector(routeInput());
  const blocker = tableNode('blocker', 250, -100, 60, 130);
  const first = selector({ nodes: [blocker] });
  assert.deepEqual(first, [
    { x: 0, y: 0 },
    { x: 0, y: 98 },
    { x: 600, y: 98 },
    { x: 600, y: 0 },
  ]);
  const resized = selector({ nodes: [{ ...blocker, measured: { width: 60, height: 220 } }] });
  assert.notEqual(resized, first);
  assert.deepEqual(resized, [
    { x: 0, y: 0 },
    { x: 0, y: -168 },
    { x: 600, y: -168 },
    { x: 600, y: 0 },
  ]);
});

test('route selector retains clear null results and detects clear/detour transitions', () => {
  const selector = createEdgeAutoRouteSelector(routeInput());
  const far = tableNode('far', 10000, 10000);
  assert.equal(selector({ nodes: [far] }), null);
  assert.equal(selector({ nodes: [{ ...far, measured: { width: 100, height: 100 } }] }), null);
  const blocker = tableNode('blocker', 250, -30, 60, 60);
  assert.ok(selector({ nodes: [far, blocker] }));
  assert.equal(selector({ nodes: [far] }), null);
});

test('route selector skips geometry reads for the same nodes reference', () => {
  let geometryReads = 0;
  let routingCalls = 0;
  const node = tableNode('blocker', 250, -30, 60, 60);
  Object.defineProperty(node, 'position', {
    get() {
      geometryReads += 1;
      return { x: 250, y: -30 };
    },
  });
  const nodes = [node];
  const selector = createEdgeAutoRouteSelector(routeInput(), (input, obstacles) => {
    routingCalls += 1;
    return buildObstacleAvoidingAutoRoute(input, obstacles);
  });
  const first = selector({ nodes });
  geometryReads = 0;
  for (let call = 0; call < 100; call += 1) assert.equal(selector({ nodes }), first);
  assert.equal(geometryReads, 0);
  assert.equal(routingCalls, 1);
});

test('route selector skips routing for new nodes with identical geometry', () => {
  let routingCalls = 0;
  const selector = createEdgeAutoRouteSelector(routeInput(), (input, obstacles) => {
    routingCalls += 1;
    return buildObstacleAvoidingAutoRoute(input, obstacles);
  });
  const nodes = [tableNode('blocker', 250, -30, 60, 60)];
  const first = selector({ nodes });
  const renamed = nodes.map((node) => ({ ...node, data: { label: 'renamed', columns: [] } }));
  assert.equal(selector({ nodes: renamed }), first);
  assert.equal(routingCalls, 1);
});

test('route selector applies every anchor, direction and marker offset from its input tuple', () => {
  const nodes = [tableNode('blocker', 250, -30, 60, 60)];
  const original = createEdgeAutoRouteSelector(routeInput());
  const changed = createEdgeAutoRouteSelector(
    routeInput({
      sourceX: 100,
      sourceY: -10,
      targetX: 500,
      targetY: -20,
      sourceDirection: -1,
      targetDirection: 1,
      sourceMarkerOffset: 10,
      targetMarkerOffset: 20,
    }),
  );
  const before = original({ nodes });
  const after = changed({ nodes });
  assert.notDeepEqual(after, before);
  assert.deepEqual(after, [
    { x: 90, y: -10 },
    { x: 90, y: -68 },
    { x: 520, y: -68 },
    { x: 520, y: -20 },
  ]);
  assert.equal(original({ nodes }), before, 'each edge must keep its own input/result cache');
});

test('route selector applies changed endpoint IDs even when the nodes array stays the same', () => {
  const nodes = [tableNode('blocker', 250, -30, 60, 60)];
  assert.ok(createEdgeAutoRouteSelector(routeInput())({ nodes }));
  for (const overrides of [{ sourceNodeId: 'blocker' }, { targetNodeId: 'blocker' }]) {
    assert.equal(createEdgeAutoRouteSelector(routeInput(overrides))({ nodes }), null);
  }
});

test('route selector recalculates a failed detour null after the blocking node moves', () => {
  const selector = createEdgeAutoRouteSelector(routeInput());
  assert.equal(selector({ nodes: [tableNode('blocker', -10, -10, 20, 20)] }), null);
  assert.ok(selector({ nodes: [tableNode('blocker', 250, -30, 60, 60)] }));
});

test('non-smoothstep and detour-off selectors return null without reading nodes', () => {
  for (const overrides of [
    { routingType: 'straight' as const },
    { routingType: 'bezier' as const },
    { detourOff: true },
  ]) {
    const selector = createEdgeAutoRouteSelector(routeInput(overrides));
    assert.equal(
      selector({
        get nodes(): never {
          throw new Error('disabled routing must not inspect nodes');
        },
      }),
      null,
    );
  }
});

test('route point equality compares ordered coordinates and null by value', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 600, y: 0 },
  ];
  assert.equal(
    areEdgeRoutePointsEqual(
      points,
      points.map((point) => ({ ...point })),
    ),
    true,
  );
  assert.equal(areEdgeRoutePointsEqual(null, null), true);
  assert.equal(areEdgeRoutePointsEqual(null, points), false);
  assert.equal(areEdgeRoutePointsEqual(points, null), false);
  assert.equal(areEdgeRoutePointsEqual(points, []), false);
  assert.equal(areEdgeRoutePointsEqual(points, [...points].reverse()), false);
  assert.equal(
    areEdgeRoutePointsEqual(points, [
      { x: 0, y: 0 },
      { x: 600, y: 1 },
    ]),
    false,
  );
});
