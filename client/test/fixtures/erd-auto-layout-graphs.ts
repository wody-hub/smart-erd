import type { Edge, Node } from '@xyflow/react';
import type { Column, TableNodeData } from '../../src/types/erd.js';
import { measureErdNode } from '../../src/lib/auto-layout.js';
import type { MetricBox } from '../../src/lib/auto-layout-metrics.js';

/** 자동정렬 테스트용 그래프 (노드와 엣지) */
export interface TestGraph {
  /** 노드 목록 */
  nodes: Node<TableNodeData>[];
  /** 엣지 목록 (source = 부모, target = 자식) */
  edges: Edge[];
}

/** 결정적 의사난수 LCG 승수 */
const LCG_MULTIPLIER = 1664525;
/** 결정적 의사난수 LCG 증분 */
const LCG_INCREMENT = 1013904223;
/** 결정적 의사난수 LCG 모듈러 */
const LCG_MODULUS = 4294967296;

/**
 * 시드 기반 결정적 난수 생성기를 만든다.
 *
 * @param seed 시드
 * @returns 0 이상 1 미만 난수를 돌려주는 함수
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
}

/**
 * 테스트용 컬럼 목록을 만든다.
 *
 * @param tableId 테이블 id
 * @param count 컬럼 수
 * @returns 컬럼 목록
 */
export function makeColumns(tableId: string, count: number): Column[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${tableId}_c${index}`,
    name: `col_${index}`,
    type: 'varchar',
    pk: index === 0,
    fk: false,
    nullable: true,
  }));
}

/**
 * 테스트용 테이블 노드를 만든다.
 *
 * @param id 노드 id
 * @param columns 컬럼 수
 * @param overrides 노드 데이터 덮어쓰기
 * @returns 노드
 */
export function makeTable(
  id: string,
  columns = 4,
  overrides: Partial<TableNodeData> = {},
): Node<TableNodeData> {
  return {
    id,
    type: 'table',
    position: { x: 0, y: 0 },
    data: { label: id, columns: makeColumns(id, columns), ...overrides },
  };
}

/**
 * 부모 -> 자식 관계 엣지를 만든다.
 *
 * @param source 부모 노드 id
 * @param target 자식 노드 id
 * @param suffix 같은 쌍의 중복 FK를 구분하는 접미사
 * @returns 엣지
 */
export function makeRelation(source: string, target: string, suffix = ''): Edge {
  return { id: `${source}->${target}${suffix}`, source, target, type: 'erdRelation' };
}

/**
 * 허브 하나에 리프 n개가 달린 스타 그래프를 만든다.
 *
 * @param leafCount 리프 수
 * @param hubColumns 허브 컬럼 수
 * @param leafColumns 리프 컬럼 수
 * @returns 그래프
 */
export function buildStar(leafCount: number, hubColumns = 8, leafColumns = 4): TestGraph {
  const nodes = [makeTable('hub', hubColumns)];
  const edges: Edge[] = [];
  for (let index = 0; index < leafCount; index += 1) {
    const id = `leaf_${String(index).padStart(3, '0')}`;
    nodes.push(makeTable(id, leafColumns));
    edges.push(makeRelation('hub', id));
  }
  return { nodes, edges };
}

/**
 * 일렬 체인 그래프를 만든다.
 *
 * @param length 노드 수
 * @returns 그래프
 */
export function buildChain(length: number): TestGraph {
  const nodes = Array.from({ length }, (_, index) =>
    makeTable(`chain_${String(index).padStart(3, '0')}`, 3),
  );
  const edges = nodes.slice(1).map((node, index) => makeRelation(nodes[index].id, node.id));
  return { nodes, edges };
}

/**
 * 균형 트리 그래프를 만든다.
 *
 * @param branching 분기 수
 * @param depth 깊이 (루트 = 0)
 * @returns 그래프
 */
export function buildTree(branching: number, depth: number): TestGraph {
  const nodes = [makeTable('tree_0', 6)];
  const edges: Edge[] = [];
  let frontier = [0];
  let nextIndex = 1;
  for (let level = 0; level < depth; level += 1) {
    const nextFrontier: number[] = [];
    frontier.forEach((parentIndex) => {
      for (let branch = 0; branch < branching; branch += 1) {
        const id = `tree_${nextIndex}`;
        nodes.push(makeTable(id, 3 + ((nextIndex + branch) % 4)));
        edges.push(makeRelation(`tree_${parentIndex}`, id));
        nextFrontier.push(nextIndex);
        nextIndex += 1;
      }
    });
    frontier = nextFrontier;
  }
  return { nodes, edges };
}

/**
 * 격자형 메시 그래프를 만든다.
 *
 * @param rows 행 수
 * @param columns 열 수
 * @returns 그래프
 */
export function buildMesh(rows: number, columns: number): TestGraph {
  const idOf = (row: number, column: number) => `mesh_${row}_${column}`;
  const nodes: Node<TableNodeData>[] = [];
  const edges: Edge[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      nodes.push(makeTable(idOf(row, column), 3));
      if (column > 0) edges.push(makeRelation(idOf(row, column - 1), idOf(row, column)));
      if (row > 0) edges.push(makeRelation(idOf(row - 1, column), idOf(row, column)));
    }
  }
  return { nodes, edges };
}

/**
 * 연결 성분 여러 개와 고립 노드를 가진 그래프를 만든다.
 *
 * @param groupSizes 성분별 노드 수 (각 성분은 첫 노드가 허브인 스타)
 * @param isolatedCount 고립 노드 수
 * @returns 그래프
 */
export function buildIsolatedGroups(groupSizes: number[], isolatedCount: number): TestGraph {
  const nodes: Node<TableNodeData>[] = [];
  const edges: Edge[] = [];
  groupSizes.forEach((size, group) => {
    const hubId = `g${group}_hub`;
    nodes.push(makeTable(hubId, 5));
    for (let index = 1; index < size; index += 1) {
      const id = `g${group}_n${index}`;
      nodes.push(makeTable(id, 3));
      edges.push(makeRelation(hubId, id));
    }
  });
  for (let index = 0; index < isolatedCount; index += 1) {
    nodes.push(makeTable(`iso_${String(index).padStart(3, '0')}`, 2 + (index % 5)));
  }
  return { nodes, edges };
}

/**
 * 허브 여러 개가 서로 연결된 다중 허브 그래프를 만든다.
 *
 * @param hubCount 허브 수
 * @param leavesPerHub 허브당 리프 수
 * @returns 그래프
 */
export function buildMultiHub(hubCount: number, leavesPerHub: number): TestGraph {
  const nodes: Node<TableNodeData>[] = [];
  const edges: Edge[] = [];
  for (let hub = 0; hub < hubCount; hub += 1) {
    nodes.push(makeTable(`hub_${hub}`, 7));
    if (hub > 0) edges.push(makeRelation(`hub_${hub - 1}`, `hub_${hub}`));
    for (let leaf = 0; leaf < leavesPerHub; leaf += 1) {
      const id = `hub_${hub}_leaf_${leaf}`;
      nodes.push(makeTable(id, 3));
      edges.push(makeRelation(`hub_${hub}`, id));
    }
  }
  return { nodes, edges };
}

/**
 * 순환, 자기참조, 중복 FK, 존재하지 않는 끝점이 섞인 퇴화 그래프를 만든다.
 *
 * @returns 그래프
 */
export function buildDegenerateGraph(): TestGraph {
  const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => makeTable(id, 3));
  const edges = [
    makeRelation('a', 'b'),
    makeRelation('b', 'c'),
    makeRelation('c', 'a'),
    makeRelation('a', 'a', '-self'),
    makeRelation('c', 'd'),
    makeRelation('c', 'd', '-dup1'),
    makeRelation('c', 'd', '-dup2'),
    makeRelation('d', 'missing'),
  ];
  return { nodes, edges };
}

/**
 * 장문명과 극단적 높이가 섞인 그래프를 만든다.
 *
 * @returns 그래프
 */
export function buildExtremeSizeGraph(): TestGraph {
  const longName = 'very_long_physical_name_'.repeat(6);
  const nodes = [
    makeTable('tall_hub', 60),
    makeTable('wide_one', 1, { label: longName, logicalTableName: longName }),
    makeTable('wide_two', 2, { label: longName, logicalTableName: longName }),
    makeTable('short_one', 1),
    makeTable('tall_two', 45),
    makeTable('short_two', 1),
  ];
  const edges = [
    makeRelation('tall_hub', 'wide_one'),
    makeRelation('tall_hub', 'wide_two'),
    makeRelation('tall_hub', 'short_one'),
    makeRelation('tall_two', 'short_two'),
    makeRelation('wide_one', 'tall_two'),
  ];
  return { nodes, edges };
}

/**
 * 성능 측정용 대형 그래프를 결정적으로 만든다 (스패닝 트리 + 추가 FK + 고립 노드).
 *
 * @param nodeCount 전체 노드 수
 * @returns 그래프
 */
export function buildScaledGraph(nodeCount: number): TestGraph {
  const random = createSeededRandom(nodeCount);
  const nodes = Array.from({ length: nodeCount }, (_, index) =>
    makeTable(`n_${String(index).padStart(4, '0')}`, 2 + Math.floor(random() * 14)),
  );
  const edges: Edge[] = [];
  const connectedCount = Math.floor(nodeCount * 0.7);
  for (let index = 1; index < connectedCount; index += 1) {
    const parent = Math.floor(random() * index);
    edges.push(makeRelation(nodes[parent].id, nodes[index].id));
  }
  for (let extra = 0; extra < Math.floor(nodeCount * 0.1); extra += 1) {
    const parent = Math.floor(random() * connectedCount);
    const child = Math.floor(random() * connectedCount);
    edges.push(makeRelation(nodes[parent].id, nodes[child].id, `-x${extra}`));
  }
  return { nodes, edges };
}

/**
 * 노드를 렌더 치수 기준 측정용 직사각형으로 변환한다.
 *
 * @param nodes 노드 목록
 * @returns 측정용 직사각형 목록
 */
export function toMetricBoxes(nodes: Node<TableNodeData>[]): MetricBox[] {
  return nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    ...measureErdNode(node),
  }));
}
