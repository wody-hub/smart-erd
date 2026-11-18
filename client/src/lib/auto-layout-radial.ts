/** 방사형 배치 계산에 쓰는 노드 크기 */
export interface LayoutItem {
  /** 노드 식별자 */
  id: string;
  /** 렌더 폭 */
  width: number;
  /** 렌더 높이 */
  height: number;
}

/** 방사형 배치 계산에 쓰는 관계 (source = 부모, target = 자식) */
export interface LayoutLink {
  /** 부모 노드 id */
  source: string;
  /** 자식 노드 id */
  target: string;
}

/** 중복 FK와 자기참조를 제거한 무방향 그래프 색인 */
export interface LayoutGraph {
  /** id 오름차순으로 정렬된 노드 id */
  ids: string[];
  /** 노드별 이웃 id (id 오름차순, 중복 없음) */
  neighbors: Map<string, string[]>;
  /** 노드를 참조하는 자식 테이블 수 (중복 제거) */
  childCount: Map<string, number>;
}

/** 허브를 중심으로 한 방사형 초기 좌표 (허브 중심이 원점) */
export interface RadialSeed {
  /** 노드 id */
  id: string;
  /** 허브로부터의 BFS 거리 (허브 = 0) */
  ring: number;
  /** 중심 x (허브 중심 기준) */
  x: number;
  /** 중심 y (허브 중심 기준) */
  y: number;
}

/** 방사형 시드 계산 옵션 */
export interface RadialSeedOptions {
  /** 노드 사이 최소 간격 */
  gap: number;
  /** 가로/세로 타원 비율 (W/H, 기본 1 = 원) */
  aspect?: number;
}

/** 한 바퀴의 라디안 */
const FULL_TURN = Math.PI * 2;
/** 첫 섹터의 시작 각도 (위쪽) */
const START_ANGLE = -Math.PI / 2;
/** 링 반지름 확대 시 최소 배율 */
const MIN_RADIUS_GROWTH = 1.02;
/** 링 반지름 확대 최대 반복 횟수 (고정 반복으로 결정성 확보) */
const MAX_RADIUS_ITERATIONS = 64;

/**
 * 문자열 id를 로캘과 무관하게 비교한다.
 *
 * @param left 왼쪽 id
 * @param right 오른쪽 id
 * @returns 정렬 비교값
 */
export function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

/**
 * 관계 목록에서 중복·자기참조·존재하지 않는 끝점을 제거한 그래프 색인을 만든다.
 *
 * @param ids 노드 id 목록
 * @param links 관계 목록
 * @returns 그래프 색인
 */
export function buildLayoutGraph(ids: string[], links: LayoutLink[]): LayoutGraph {
  const sortedIds = [...new Set(ids)].sort(compareIds);
  const neighborSets = new Map<string, Set<string>>(sortedIds.map((id) => [id, new Set<string>()]));
  const childSets = new Map<string, Set<string>>(sortedIds.map((id) => [id, new Set<string>()]));

  links.forEach((link) => {
    const sourceNeighbors = neighborSets.get(link.source);
    const targetNeighbors = neighborSets.get(link.target);
    const sourceChildren = childSets.get(link.source);
    if (!sourceNeighbors || !targetNeighbors || !sourceChildren || link.source === link.target)
      return;
    sourceNeighbors.add(link.target);
    targetNeighbors.add(link.source);
    sourceChildren.add(link.target);
  });

  return {
    ids: sortedIds,
    neighbors: new Map(
      sortedIds.map((id) => [id, [...(neighborSets.get(id) ?? [])].sort(compareIds)]),
    ),
    childCount: new Map(sortedIds.map((id) => [id, childSets.get(id)?.size ?? 0])),
  };
}

/**
 * 약한 연결 성분을 찾는다. 큰 성분이 앞에 오고 동률이면 최소 id 순이다.
 *
 * @param graph 그래프 색인
 * @returns 성분별 id 목록 (각 성분은 id 오름차순)
 */
export function findConnectedComponents(graph: LayoutGraph): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  graph.ids.forEach((startId) => {
    if (visited.has(startId)) return;
    const queue = [startId];
    visited.add(startId);
    for (let index = 0; index < queue.length; index += 1) {
      (graph.neighbors.get(queue[index]) ?? []).forEach((neighborId) => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }
    components.push(queue.sort(compareIds));
  });

  return components.sort(
    (left, right) => right.length - left.length || compareIds(left[0], right[0]),
  );
}

/**
 * 한 노드에서 같은 성분의 모든 노드까지 BFS 거리의 합을 구한다 (거리 중심성의 역수).
 *
 * @param startId 시작 노드 id
 * @param graph 그래프 색인
 * @returns 거리 합
 */
function sumDistancesFrom(startId: string, graph: LayoutGraph): number {
  const depthById = new Map<string, number>([[startId, 0]]);
  const queue = [startId];
  let total = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const depth = depthById.get(queue[index]) ?? 0;
    total += depth;
    (graph.neighbors.get(queue[index]) ?? []).forEach((neighborId) => {
      if (!depthById.has(neighborId)) {
        depthById.set(neighborId, depth + 1);
        queue.push(neighborId);
      }
    });
  }
  return total;
}

/**
 * 성분의 허브(메인 테이블)를 고른다.
 *
 * 사용자 지정 허브가 있으면 우선하고, 없으면 병합 차수, 참조하는 자식 수, 거리 중심성, id 순으로 결정한다.
 *
 * @param component 성분의 노드 id 목록
 * @param graph 그래프 색인
 * @param preferredIds 사용자가 지정한 메인 테이블 id (선택)
 * @returns 허브 노드 id
 */
export function selectHub(
  component: string[],
  graph: LayoutGraph,
  preferredIds: ReadonlySet<string> = new Set(),
): string {
  const preferred = component.find((id) => preferredIds.has(id));
  if (preferred !== undefined) return preferred;

  const degreeOf = (id: string) => graph.neighbors.get(id)?.length ?? 0;
  const childrenOf = (id: string) => graph.childCount.get(id) ?? 0;
  const maxDegree = Math.max(...component.map(degreeOf));
  const byDegree = component.filter((id) => degreeOf(id) === maxDegree);
  const maxChildren = Math.max(...byDegree.map(childrenOf));
  const candidates = byDegree.filter((id) => childrenOf(id) === maxChildren);
  if (candidates.length === 1) return candidates[0];

  return candidates
    .map((id) => ({ id, distance: sumDistancesFrom(id, graph) }))
    .sort((left, right) => left.distance - right.distance || compareIds(left.id, right.id))[0].id;
}

/**
 * 반지름 r의 링에서 반지름 ρ 노드가 차지하는 각도 폭을 구한다.
 *
 * @param nodeRadius 노드 외접 반지름 ρ = √(w²+h²)/2
 * @param ringRadius 링 반지름
 * @param gap 노드 사이 간격
 * @returns 필요 각도 (라디안)
 */
function reserveAngle(nodeRadius: number, ringRadius: number, gap: number): number {
  if (ringRadius <= 0) return FULL_TURN;
  const ratio = (nodeRadius + gap / 2) / ringRadius;
  return ratio >= 1 ? Math.PI : 2 * Math.asin(ratio);
}

/**
 * 허브에서 BFS로 링을 만들고, 직사각 노드 외접 반지름 기반 섹터 폭을 예약해 방사형 시드 좌표를 계산한다.
 *
 * 링 간격은 인접 링 최대 ρ의 합 + gap 이상이며, 각 서브트리는 자신의 링별 공간 수요에 비례한 섹터를 받는다.
 * 순수 계산이며 충돌 보정은 하지 않는다 (초기값 용도).
 *
 * @param component 성분의 노드 id 목록
 * @param hubId 허브 노드 id
 * @param graph 그래프 색인
 * @param sizes 노드 크기 맵
 * @param options 간격과 타원 비율
 * @returns BFS 순서의 시드 목록 (첫 원소가 허브)
 */
export function computeRadialSeeds(
  component: string[],
  hubId: string,
  graph: LayoutGraph,
  sizes: Map<string, LayoutItem>,
  options: RadialSeedOptions,
): RadialSeed[] {
  const { gap, aspect = 1 } = options;
  const members = new Set(component);
  const depthById = new Map<string, number>([[hubId, 0]]);
  const childrenById = new Map<string, string[]>();
  const order = [hubId];

  for (let index = 0; index < order.length; index += 1) {
    const parentId = order[index];
    const children: string[] = [];
    (graph.neighbors.get(parentId) ?? []).forEach((neighborId) => {
      if (members.has(neighborId) && !depthById.has(neighborId)) {
        depthById.set(neighborId, (depthById.get(parentId) ?? 0) + 1);
        children.push(neighborId);
        order.push(neighborId);
      }
    });
    childrenById.set(parentId, children);
  }

  const nodeRadiusOf = (id: string) => {
    const size = sizes.get(id);
    return size ? Math.hypot(size.width, size.height) / 2 : 0;
  };
  const maxRadiusByRing: number[] = [];
  order.forEach((id) => {
    const ring = depthById.get(id) ?? 0;
    maxRadiusByRing[ring] = Math.max(maxRadiusByRing[ring] ?? 0, nodeRadiusOf(id));
  });

  const baseRadii: number[] = [0];
  for (let ring = 1; ring < maxRadiusByRing.length; ring += 1) {
    baseRadii[ring] = baseRadii[ring - 1] + maxRadiusByRing[ring - 1] + maxRadiusByRing[ring] + gap;
  }

  const demandById = new Map<string, number>();
  const computeDemands = (growth: number): number => {
    for (let index = order.length - 1; index > 0; index -= 1) {
      const id = order[index];
      const ring = depthById.get(id) ?? 0;
      const childDemand = (childrenById.get(id) ?? []).reduce(
        (sum, childId) => sum + (demandById.get(childId) ?? 0),
        0,
      );
      demandById.set(
        id,
        Math.max(reserveAngle(nodeRadiusOf(id), baseRadii[ring] * growth, gap), childDemand),
      );
    }
    return (childrenById.get(hubId) ?? []).reduce(
      (sum, childId) => sum + (demandById.get(childId) ?? 0),
      0,
    );
  };

  let growth = 1;
  let totalDemand = computeDemands(growth);
  for (
    let iteration = 0;
    iteration < MAX_RADIUS_ITERATIONS && totalDemand > FULL_TURN;
    iteration += 1
  ) {
    growth *= Math.max(MIN_RADIUS_GROWTH, totalDemand / FULL_TURN);
    totalDemand = computeDemands(growth);
  }

  const sectorStart = new Map<string, number>([[hubId, START_ANGLE]]);
  const sectorWidth = new Map<string, number>([[hubId, FULL_TURN]]);
  const ratioX = Math.sqrt(aspect);
  const ratioY = 1 / ratioX;
  const seeds: RadialSeed[] = [{ id: hubId, ring: 0, x: 0, y: 0 }];

  order.forEach((parentId) => {
    const children = childrenById.get(parentId) ?? [];
    const childDemand = children.reduce((sum, childId) => sum + (demandById.get(childId) ?? 0), 0);
    let cursor = sectorStart.get(parentId) ?? START_ANGLE;
    const parentWidth = sectorWidth.get(parentId) ?? FULL_TURN;

    children.forEach((childId) => {
      const width =
        childDemand > 0 ? (parentWidth * (demandById.get(childId) ?? 0)) / childDemand : 0;
      const ring = depthById.get(childId) ?? 1;
      const angle = cursor + width / 2;
      const radius = baseRadii[ring] * growth;
      sectorStart.set(childId, cursor);
      sectorWidth.set(childId, width);
      cursor += width;
      seeds.push({
        id: childId,
        ring,
        x: Math.round(radius * Math.cos(angle) * ratioX),
        y: Math.round(radius * Math.sin(angle) * ratioY),
      });
    });
  });

  return seeds;
}
