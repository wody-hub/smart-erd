import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildRoundedOrthogonalSvgPath,
  buildStraightEdgePoints,
  buildWaypointMidpoints,
  routePointsToWaypoints,
  splitOrthogonalSegment,
  shiftOrthogonalSegment,
  toggleOrthogonalSegmentDetail,
} from '../../src/components/erd/edgeWaypointGeometry.js';

function assertOrthogonal(points: Array<{ x: number; y: number }>) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    assert.ok(
      current.x === next.x || current.y === next.y,
      `segment ${index} is diagonal: (${current.x}, ${current.y}) -> (${next.x}, ${next.y})`,
    );
  }
}

test('buildStraightEdgePoints 는 waypoint 가 없어도 기본 직교 경로를 만든다', () => {
  const points = buildStraightEdgePoints({
    sourceX: 100,
    sourceY: 120,
    targetX: 320,
    targetY: 260,
    sourceDirection: 1,
    targetDirection: -1,
    sourceMarkerOffset: 12,
    targetMarkerOffset: 14,
    waypoints: [],
  });

  assert.deepEqual(points, [
    { x: 112, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ]);
  assertOrthogonal(points);
});

test('buildStraightEdgePoints 는 자유 waypoint 입력도 직교 세그먼트로 확장한다', () => {
  const points = buildStraightEdgePoints({
    sourceX: 80,
    sourceY: 100,
    targetX: 360,
    targetY: 240,
    sourceDirection: 1,
    targetDirection: -1,
    sourceMarkerOffset: 12,
    targetMarkerOffset: 14,
    waypoints: [
      { x: 170, y: 150 },
      { x: 250, y: 190 },
    ],
  });

  assert.deepEqual(points, [
    { x: 92, y: 100 },
    { x: 170, y: 100 },
    { x: 170, y: 150 },
    { x: 250, y: 150 },
    { x: 250, y: 240 },
    { x: 346, y: 240 },
  ]);
  assertOrthogonal(points);
});

test('buildRoundedOrthogonalSvgPath 는 직교 꺾임에 라운드 path 를 만든다', () => {
  const path = buildRoundedOrthogonalSvgPath([
    { x: 112, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ]);

  assert.equal(
    path,
    'M 112,120 L 197,120 Q 209,120 209,132 L 209,248 Q 209,260 221,260 L 306,260',
  );
});

test('buildWaypointMidpoints 는 직교 세그먼트별 midpoint 와 올바른 insertIndex 를 반환한다', () => {
  const midpoints = buildWaypointMidpoints({
    sourceX: 80,
    sourceY: 100,
    targetX: 360,
    targetY: 240,
    sourceDirection: 1,
    targetDirection: -1,
    sourceMarkerOffset: 12,
    targetMarkerOffset: 14,
    waypoints: [{ x: 170, y: 150 }],
  });

  assert.deepEqual(midpoints, [
    { x: 131, y: 100, insertIndex: 0 },
    { x: 170, y: 170, insertIndex: 0 },
    { x: 258, y: 240, insertIndex: 1 },
  ]);
});

test('shiftOrthogonalSegment 는 내부 세로 세그먼트를 평행 이동한다', () => {
  const routePoints = [
    { x: 112, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ];

  const shifted = shiftOrthogonalSegment(routePoints, 1, 260);

  assert.deepEqual(shifted, [
    { x: 112, y: 120 },
    { x: 260, y: 120 },
    { x: 260, y: 260 },
    { x: 306, y: 260 },
  ]);
  assert.deepEqual(routePointsToWaypoints(shifted), [
    { x: 260, y: 120 },
    { x: 260, y: 260 },
  ]);
});

test('shiftOrthogonalSegment 는 첫 세그먼트 이동 시 endpoint 근처 bend 를 자동 생성한다', () => {
  const routePoints = [
    { x: 112, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ];

  const shifted = shiftOrthogonalSegment(routePoints, 0, 180);

  assert.deepEqual(shifted, [
    { x: 112, y: 120 },
    { x: 112, y: 180 },
    { x: 209, y: 180 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ]);
  assertOrthogonal(shifted);
});

test('splitOrthogonalSegment 는 가로 세그먼트를 더블클릭 지점 기준 detour 로 분할한다', () => {
  const routePoints = [
    { x: 112, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ];

  const split = splitOrthogonalSegment(routePoints, 0, { x: 180, y: 120 });

  assert.deepEqual(split, [
    { x: 112, y: 120 },
    { x: 156, y: 120 },
    { x: 156, y: 152 },
    { x: 204, y: 152 },
    { x: 204, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ]);
  assertOrthogonal(split);
  assert.deepEqual(routePointsToWaypoints(split), [
    { x: 156, y: 120 },
    { x: 156, y: 152 },
    { x: 204, y: 152 },
    { x: 204, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
  ]);
});

test('splitOrthogonalSegment 는 세로 세그먼트를 진행 방향에 맞춰 분할한다', () => {
  const routePoints = [
    { x: 112, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ];

  const split = splitOrthogonalSegment(routePoints, 1, { x: 209, y: 180 });

  assert.deepEqual(split, [
    { x: 112, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 156 },
    { x: 241, y: 156 },
    { x: 241, y: 204 },
    { x: 209, y: 204 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ]);
  assertOrthogonal(split);
});

test('toggleOrthogonalSegmentDetail 는 detour 중앙 세그먼트를 더블클릭하면 다시 접는다', () => {
  const routePoints = [
    { x: 112, y: 120 },
    { x: 156, y: 120 },
    { x: 156, y: 152 },
    { x: 204, y: 152 },
    { x: 204, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ];

  const collapsed = toggleOrthogonalSegmentDetail(routePoints, 2, { x: 180, y: 152 });

  assert.deepEqual(collapsed, [
    { x: 112, y: 120 },
    { x: 209, y: 120 },
    { x: 209, y: 260 },
    { x: 306, y: 260 },
  ]);
  assertOrthogonal(collapsed);
});
