import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildObstacleAvoidingAutoRoute } from '../../src/components/erd/edgeAutoRoute.js';

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

function routeIntersectsObstacle(
  points: Array<{ x: number; y: number }>,
  obstacle: { left: number; right: number; top: number; bottom: number },
) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (start.x === end.x) {
      if (
        start.x > obstacle.left &&
        start.x < obstacle.right &&
        Math.max(start.y, end.y) > obstacle.top &&
        Math.min(start.y, end.y) < obstacle.bottom
      ) {
        return true;
      }
      continue;
    }

    if (
      start.y > obstacle.top &&
      start.y < obstacle.bottom &&
      Math.max(start.x, end.x) > obstacle.left &&
      Math.min(start.x, end.x) < obstacle.right
    ) {
      return true;
    }
  }

  return false;
}

test('buildObstacleAvoidingAutoRoute 는 기본 경로가 장애물과 겹치지 않으면 null 을 반환한다', () => {
  const route = buildObstacleAvoidingAutoRoute(
    {
      sourceX: 100,
      sourceY: 120,
      targetX: 320,
      targetY: 260,
      sourceDirection: 1,
      targetDirection: -1,
      sourceMarkerOffset: 12,
      targetMarkerOffset: 14,
      waypoints: [],
    },
    [{ left: 360, right: 420, top: 80, bottom: 180 }],
  );

  assert.equal(route, null);
});

test('buildObstacleAvoidingAutoRoute 는 중간 테이블을 피하는 우회 경로를 만든다', () => {
  const obstacle = { left: 160, right: 240, top: 90, bottom: 290 };
  const route = buildObstacleAvoidingAutoRoute(
    {
      sourceX: 100,
      sourceY: 120,
      targetX: 300,
      targetY: 260,
      sourceDirection: 1,
      targetDirection: -1,
      sourceMarkerOffset: 12,
      targetMarkerOffset: 14,
      waypoints: [],
    },
    [obstacle],
  );

  assert.ok(route);
  assertOrthogonal(route);
  assert.equal(routeIntersectsObstacle(route, obstacle), false);
  assert.equal(route[0]?.x, 112);
  assert.equal(route[route.length - 1]?.x, 286);
});

test('buildObstacleAvoidingAutoRoute 는 앵커 근처 padding overlap 이 있어도 실제 테이블을 피해 우회한다', () => {
  const obstacle = { left: 130, right: 250, top: 110, bottom: 250 };
  const route = buildObstacleAvoidingAutoRoute(
    {
      sourceX: 100,
      sourceY: 180,
      targetX: 520,
      targetY: 180,
      sourceDirection: 1,
      targetDirection: -1,
      sourceMarkerOffset: 12,
      targetMarkerOffset: 14,
      waypoints: [],
    },
    [obstacle],
  );

  assert.ok(route);
  assertOrthogonal(route);
  assert.equal(routeIntersectsObstacle(route, obstacle), false);
});
