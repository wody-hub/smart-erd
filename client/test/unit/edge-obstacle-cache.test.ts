import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getCachedEdgeObstacleRects } from '../../src/components/erd/edgeAutoRoute.js';

test('getCachedEdgeObstacleRects 는 스냅샷별 배열을 재사용하고 endpoint를 제외한다', () => {
  const nodes = [
    { id: 'source', type: 'table', position: { x: 0, y: 0 }, data: { columns: [] } },
    { id: 'middle', type: 'table', position: { x: 500, y: 100 }, data: { columns: [] } },
    { id: 'target', type: 'table', position: { x: 1000, y: 0 }, data: { columns: [] } },
  ];

  const first = getCachedEdgeObstacleRects(nodes, 'source', 'target');
  const repeated = getCachedEdgeObstacleRects(nodes, 'source', 'target');

  assert.equal(first, repeated);
  assert.deepEqual(first, [{ left: 500, right: 920, top: 100, bottom: 152 }]);
});

test('getCachedEdgeObstacleRects 는 변경된 노드 스냅샷에서 새 좌표를 반환한다', () => {
  const previousNodes = [
    { id: 'middle', type: 'table', position: { x: 500, y: 100 }, data: { columns: [] } },
  ];
  const nextNodes = [
    { id: 'middle', type: 'table', position: { x: 700, y: 100 }, data: { columns: [] } },
  ];

  assert.notEqual(
    getCachedEdgeObstacleRects(previousNodes, 'source', 'target'),
    getCachedEdgeObstacleRects(nextNodes, 'source', 'target'),
  );
  assert.equal(getCachedEdgeObstacleRects(nextNodes, 'source', 'target')[0].left, 700);
});
