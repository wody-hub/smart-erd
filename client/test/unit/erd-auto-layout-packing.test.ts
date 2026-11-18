import assert from 'node:assert/strict';
import { test } from 'node:test';
import { measureErdNode } from '../../src/lib/auto-layout.js';
import { computeOverlapArea } from '../../src/lib/auto-layout-metrics.js';
import {
  BoxGrid,
  findNearestFreePosition,
  type PlacedBox,
} from '../../src/lib/auto-layout-packing.js';
import { computeRadialLayout } from '../../src/lib/auto-layout-radial-layout.js';
import type { LayoutItem, LayoutLink } from '../../src/lib/auto-layout-radial.js';
import {
  buildChain,
  buildDegenerateGraph,
  buildExtremeSizeGraph,
  buildIsolatedGroups,
  buildMesh,
  buildMultiHub,
  buildScaledGraph,
  buildStar,
  buildTree,
  type TestGraph,
} from '../fixtures/erd-auto-layout-graphs.js';
import { buildAnonymizedRealDiagram } from '../fixtures/erd-auto-layout-real-diagram.js';

/** 노드 사이 최소 간격 (구현의 RADIAL_NODE_GAP 이하여야 한다) */
const MIN_NODE_GAP = 100;
/** 배치 결과 좌상단 여백 */
const LAYOUT_MARGIN = 40;

/**
 * 테스트 그래프를 배치 입력으로 변환한다.
 *
 * @param graph 테스트 그래프
 * @returns 노드 크기와 관계
 */
function toLayoutInput(graph: TestGraph): { items: LayoutItem[]; links: LayoutLink[] } {
  return {
    items: graph.nodes.map((node) => ({ id: node.id, ...measureErdNode(node) })),
    links: graph.edges.map((edge) => ({ source: edge.source, target: edge.target })),
  };
}

/**
 * 배치 결과에서 겹침 면적 합을 구한다.
 *
 * @param items 노드 크기
 * @param positions 좌상단 좌표
 * @returns 겹침 면적 합
 */
function totalOverlap(
  items: LayoutItem[],
  positions: Map<string, { x: number; y: number }>,
): number {
  const boxes = items.map((item) => ({
    ...item,
    x: positions.get(item.id)?.x ?? 0,
    y: positions.get(item.id)?.y ?? 0,
  }));
  let total = 0;
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      total += computeOverlapArea(boxes[left], boxes[right]);
    }
  }
  return total;
}

/**
 * 입력을 깊게 동결한다 (변경 시도 시 예외).
 *
 * @param value 동결할 값
 * @returns 같은 값
 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
}

const SYNTHETIC_GRAPHS: Array<[string, () => TestGraph]> = [
  ['star', () => buildStar(30)],
  ['chain', () => buildChain(18)],
  ['tree', () => buildTree(3, 3)],
  ['mesh', () => buildMesh(5, 6)],
  ['isolated groups', () => buildIsolatedGroups([8, 5, 3], 12)],
  ['multi hub', () => buildMultiHub(3, 6)],
  ['degenerate (cycle, self reference, duplicate FK, unknown endpoint)', buildDegenerateGraph],
  ['extreme sizes', buildExtremeSizeGraph],
  ['real anonymized diagram', buildAnonymizedRealDiagram],
  ['scaled 100', () => buildScaledGraph(100)],
];

test('BoxGrid.isFree enforces the minimum gap and ignores far boxes', () => {
  const grid = new BoxGrid();
  const box: PlacedBox = { id: 'a', x: 0, y: 0, width: 800, height: 400, mark: 0 };
  grid.insert(box);

  assert.equal(grid.isFree(850, 0, 800, 400, 100), false);
  assert.equal(grid.isFree(900, 0, 800, 400, 100), true);
  assert.equal(grid.isFree(0, 450, 800, 400, 100), false);
  assert.equal(grid.isFree(-5000, -5000, 800, 400, 100), true);
});

test('BoxGrid.isFree detects collisions for boxes spanning several cells', () => {
  const grid = new BoxGrid();
  grid.insert({ id: 'tall', x: 0, y: 0, width: 800, height: 5000, mark: 0 });

  assert.equal(grid.isFree(100, 4000, 200, 200, 0), false);
  assert.equal(grid.isFree(800, 4000, 200, 200, 0), true);
});

test('findNearestFreePosition returns the target when free and a touching spot when blocked', () => {
  const grid = new BoxGrid();
  grid.insert({ id: 'a', x: -400, y: -200, width: 800, height: 400, mark: 0 });
  const item: LayoutItem = { id: 'b', width: 800, height: 400 };

  const free = findNearestFreePosition(grid, item, { x: 3000, y: 0 }, [], 100);
  const blocked = findNearestFreePosition(grid, item, { x: 0, y: 0 }, [], 100);

  assert.deepEqual(free, { x: 2600, y: -200 });
  assert.ok(grid.isFree(blocked.x, blocked.y, 800, 400, 100));
  assert.ok(Math.hypot(blocked.x + 400, blocked.y + 200) < 1500);
});

for (const [name, build] of SYNTHETIC_GRAPHS) {
  test(`computeRadialLayout (${name}): finite integer coordinates, no overlap, margin, deterministic`, () => {
    const { items, links } = toLayoutInput(build());

    const first = computeRadialLayout(items, links);
    const second = computeRadialLayout(items, links);

    assert.deepEqual([...first.positions], [...second.positions]);
    assert.deepEqual(first.hubIds, second.hubIds);
    assert.equal(first.positions.size, items.length);
    assert.equal(totalOverlap(items, first.positions), 0);
    const xs = [...first.positions.values()].map((position) => position.x);
    const ys = [...first.positions.values()].map((position) => position.y);
    [...xs, ...ys].forEach((value) =>
      assert.ok(Number.isInteger(value), `non-integer coordinate ${value}`),
    );
    assert.equal(Math.min(...xs), LAYOUT_MARGIN);
    assert.equal(Math.min(...ys), LAYOUT_MARGIN);
  });

  test(`computeRadialLayout (${name}): keeps the minimum node gap and does not mutate inputs`, () => {
    const { items, links } = toLayoutInput(build());
    deepFreeze(items);
    deepFreeze(links);

    const { positions } = computeRadialLayout(items, links);

    const inflated = items.map((item) => ({
      ...item,
      x: (positions.get(item.id)?.x ?? 0) - MIN_NODE_GAP / 2,
      y: (positions.get(item.id)?.y ?? 0) - MIN_NODE_GAP / 2,
      width: item.width + MIN_NODE_GAP,
      height: item.height + MIN_NODE_GAP,
    }));
    for (let left = 0; left < inflated.length; left += 1) {
      for (let right = left + 1; right < inflated.length; right += 1) {
        assert.equal(computeOverlapArea(inflated[left], inflated[right]), 0);
      }
    }
  });
}

test('computeRadialLayout gives the same result for any input order', () => {
  const { items, links } = toLayoutInput(buildAnonymizedRealDiagram());
  const shuffled = [...items].reverse();
  const shuffledLinks = [...links].reverse();

  const base = computeRadialLayout(items, links);
  const reordered = computeRadialLayout(shuffled, shuffledLinks);

  assert.deepEqual(
    [...base.positions].sort(([left], [right]) => (left < right ? -1 : 1)),
    [...reordered.positions].sort(([left], [right]) => (left < right ? -1 : 1)),
  );
});

test('computeRadialLayout handles empty and single-node inputs', () => {
  assert.equal(computeRadialLayout([], []).positions.size, 0);

  const single = computeRadialLayout([{ id: 'only', width: 820, height: 300 }], []);
  assert.deepEqual(single.positions.get('only'), { x: LAYOUT_MARGIN, y: LAYOUT_MARGIN });
  assert.deepEqual(single.hubIds, ['only']);
});

test('computeRadialLayout respects a preferred hub and reports it first for the largest component', () => {
  const { items, links } = toLayoutInput(buildStar(6));

  const defaultHub = computeRadialLayout(items, links).hubIds[0];
  const preferred = computeRadialLayout(items, links, { preferredHubIds: ['leaf_003'] }).hubIds[0];

  assert.equal(defaultHub, 'hub');
  assert.equal(preferred, 'leaf_003');
});

test('computeRadialLayout 500-node graph has no overlap using the bounded large-graph path', () => {
  const { items, links } = toLayoutInput(buildScaledGraph(500));

  const { positions } = computeRadialLayout(items, links);

  assert.equal(positions.size, 500);
  assert.equal(totalOverlap(items, positions), 0);
});
