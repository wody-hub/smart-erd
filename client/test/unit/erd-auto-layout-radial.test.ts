import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLayoutGraph,
  computeRadialSeeds,
  findConnectedComponents,
  selectHub,
  type LayoutItem,
} from '../../src/lib/auto-layout-radial.js';

/** 테스트에서 쓰는 노드 사이 간격 */
const GAP = 100;

/**
 * 같은 크기 노드 맵을 만든다.
 *
 * @param ids 노드 id
 * @param width 폭
 * @param height 높이
 * @returns 크기 맵
 */
function uniformSizes(ids: string[], width = 800, height = 400): Map<string, LayoutItem> {
  return new Map(ids.map((id) => [id, { id, width, height }]));
}

test('buildLayoutGraph drops self references, duplicates and unknown endpoints', () => {
  const graph = buildLayoutGraph(
    ['b', 'a', 'c'],
    [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
      { source: 'a', target: 'a' },
      { source: 'a', target: 'missing' },
    ],
  );

  assert.deepEqual(graph.ids, ['a', 'b', 'c']);
  assert.deepEqual(graph.neighbors.get('a'), ['b']);
  assert.deepEqual(graph.neighbors.get('b'), ['a']);
  assert.deepEqual(graph.neighbors.get('c'), []);
  assert.equal(graph.childCount.get('a'), 1);
  assert.equal(graph.childCount.get('b'), 1);
});

test('findConnectedComponents orders larger components first with stable id tie-breaks', () => {
  const graph = buildLayoutGraph(
    ['z', 'y', 'a', 'b', 'c', 'solo2', 'solo1'],
    [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'y', target: 'z' },
    ],
  );

  assert.deepEqual(findConnectedComponents(graph), [
    ['a', 'b', 'c'],
    ['y', 'z'],
    ['solo1'],
    ['solo2'],
  ]);
});

test('selectHub prefers merged degree, then referencing children, then centrality, then id', () => {
  const star = buildLayoutGraph(
    ['leaf1', 'leaf2', 'leaf3', 'hub'],
    ['leaf1', 'leaf2', 'leaf3'].map((id) => ({ source: 'hub', target: id })),
  );
  assert.equal(selectHub(['hub', 'leaf1', 'leaf2', 'leaf3'], star), 'hub');

  const chain = buildLayoutGraph(
    ['a', 'b', 'c', 'd', 'e'],
    [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
      { source: 'd', target: 'e' },
    ],
  );
  assert.equal(selectHub(['a', 'b', 'c', 'd', 'e'], chain), 'c');

  const tied = buildLayoutGraph(['m', 'k'], [{ source: 'm', target: 'k' }]);
  assert.equal(selectHub(['k', 'm'], tied), 'm');
  assert.equal(selectHub(['k', 'm'], tied, new Set(['k'])), 'k');
});

test('selectHub is not fooled by duplicate FKs between the same table pair', () => {
  const links = [
    { source: 'a', target: 'b' },
    { source: 'a', target: 'b' },
    { source: 'a', target: 'b' },
    { source: 'c', target: 'd' },
    { source: 'c', target: 'e' },
    { source: 'c', target: 'f' },
  ];
  const graph = buildLayoutGraph(['a', 'b', 'c', 'd', 'e', 'f'], links);

  assert.equal(selectHub(['c', 'd', 'e', 'f'], graph), 'c');
});

test('computeRadialSeeds puts equal star leaves on one ring without circumscribed-disk overlap', () => {
  const leafIds = Array.from({ length: 12 }, (_, index) => `leaf${String(index).padStart(2, '0')}`);
  const ids = ['hub', ...leafIds];
  const graph = buildLayoutGraph(
    ids,
    leafIds.map((id) => ({ source: 'hub', target: id })),
  );
  const sizes = uniformSizes(ids);

  const seeds = computeRadialSeeds(ids, 'hub', graph, sizes, { gap: GAP });

  assert.equal(seeds[0].id, 'hub');
  assert.deepEqual([seeds[0].x, seeds[0].y], [0, 0]);
  const leafSeeds = seeds.slice(1);
  const radii = leafSeeds.map((seed) => Math.hypot(seed.x, seed.y));
  assert.ok(Math.max(...radii) - Math.min(...radii) < 2);
  const diskRadius = Math.hypot(800, 400) / 2;
  for (let left = 0; left < leafSeeds.length; left += 1) {
    for (let right = left + 1; right < leafSeeds.length; right += 1) {
      const chord = Math.hypot(
        leafSeeds[left].x - leafSeeds[right].x,
        leafSeeds[left].y - leafSeeds[right].y,
      );
      assert.ok(
        chord >= 2 * diskRadius + GAP - 4,
        `leaf disks ${left}/${right} overlap (${chord})`,
      );
    }
  }
});

test('computeRadialSeeds assigns BFS rings and keeps children outside their parents', () => {
  const ids = ['root', 'a', 'b', 'a1', 'a2', 'b1', 'a1x'];
  const links = [
    ['root', 'a'],
    ['root', 'b'],
    ['a', 'a1'],
    ['a', 'a2'],
    ['b', 'b1'],
    ['a1', 'a1x'],
  ].map(([source, target]) => ({ source, target }));
  const graph = buildLayoutGraph(ids, links);

  const seeds = computeRadialSeeds(ids, 'root', graph, uniformSizes(ids), { gap: GAP });
  const byId = new Map(seeds.map((seed) => [seed.id, seed]));

  assert.deepEqual(
    ['root', 'a', 'b', 'a1', 'a2', 'b1', 'a1x'].map((id) => byId.get(id)?.ring),
    [0, 1, 1, 2, 2, 2, 3],
  );
  const radiusOf = (id: string) => Math.hypot(byId.get(id)?.x ?? 0, byId.get(id)?.y ?? 0);
  assert.ok(radiusOf('a') < radiusOf('a1'));
  assert.ok(radiusOf('a1') < radiusOf('a1x'));
  assert.ok(radiusOf('b') < radiusOf('b1'));
});

test('computeRadialSeeds is deterministic and does not mutate its inputs', () => {
  const ids = ['hub', 'x', 'y', 'z'];
  const links = ids.slice(1).map((id) => ({ source: 'hub', target: id }));
  const graph = buildLayoutGraph(ids, links);
  const sizes = uniformSizes(ids);
  const before = JSON.stringify([...sizes.values()]);

  const first = computeRadialSeeds(ids, 'hub', graph, sizes, { gap: GAP });
  const second = computeRadialSeeds(ids, 'hub', graph, sizes, { gap: GAP });

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify([...sizes.values()]), before);
});

test('computeRadialSeeds widens the ring instead of overlapping when a star has many leaves', () => {
  const leafIds = Array.from({ length: 60 }, (_, index) => `leaf${String(index).padStart(3, '0')}`);
  const ids = ['hub', ...leafIds];
  const graph = buildLayoutGraph(
    ids,
    leafIds.map((id) => ({ source: 'hub', target: id })),
  );

  const seeds = computeRadialSeeds(ids, 'hub', graph, uniformSizes(ids), { gap: GAP });

  const ringRadius = Math.hypot(seeds[1].x, seeds[1].y);
  assert.ok(
    ringRadius > (60 * 450) / (2 * Math.PI),
    `ring radius ${ringRadius} too small for 60 leaves`,
  );
  assert.ok(seeds.every((seed) => Number.isFinite(seed.x) && Number.isFinite(seed.y)));
});
