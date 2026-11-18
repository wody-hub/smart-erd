import {
  layoutComponentFromSeeds,
  layoutSingleNode,
  packComponentsCircularly,
  type ComponentPlacement,
} from './auto-layout-packing.js';
import {
  buildLayoutGraph,
  computeRadialSeeds,
  findConnectedComponents,
  selectHub,
  type LayoutGraph,
  type LayoutItem,
  type LayoutLink,
} from './auto-layout-radial.js';

/** 방사형 자동정렬 옵션 */
export interface RadialLayoutOptions {
  /** 가로/세로 목표 비율 (W/H). 기본 1 = 원, 명시하면 타원 목표 */
  targetAspect?: number;
  /** 사용자가 지정한 메인(허브) 테이블 id. 성분에 있으면 우선한다 */
  preferredHubIds?: string[];
  /** 이 노드 수를 넘으면 시드 압축 후보를 줄여 계산량을 고정한다 */
  largeGraphThreshold?: number;
}

/** 방사형 배치 결과 */
export interface RadialLayoutResult {
  /** 노드 id별 좌상단 좌표 (최소 좌표가 LAYOUT_MARGIN) */
  positions: Map<string, { x: number; y: number }>;
  /** 성분별 허브 id (큰 성분 순). 첫 항목이 주허브 */
  hubIds: string[];
}

/** 기본 목표 비율 (원형) */
const DEFAULT_RADIAL_ASPECT = 1;
/** 같은 성분 안 노드 사이 최소 간격 */
const RADIAL_NODE_GAP = 100;
/** 서로 다른 성분 사이 최소 간격 */
const RADIAL_COMPONENT_GAP = 220;
/** 배치 결과의 좌상단 여백 */
const RADIAL_LAYOUT_MARGIN = 40;
/** 기본 대형 그래프 기준 노드 수 */
const DEFAULT_LARGE_GRAPH_THRESHOLD = 300;
/** 일반 크기에서 시도하는 시드 압축 배율 */
const DEFAULT_SEED_SCALES = [1, 0.6, 0.35, 0.2, 0.1, 0.03];
/** 대형 그래프에서 시도하는 시드 압축 배율 */
const LARGE_GRAPH_SEED_SCALES = [0.1, 0.01];

/**
 * 허브 중심 방사형 초기 배치, 직사각 충돌 완화, 원형 성분 패킹으로 노드 좌표를 계산한다.
 *
 * 결정적이며(정렬된 id, 고정 반복, 정수 좌표) 입력을 변경하지 않는다. 노드 간 겹침은 0이다.
 *
 * @param items 노드 크기 목록
 * @param links 관계 목록 (source = 부모)
 * @param options 배치 옵션
 * @returns 노드 id별 좌상단 좌표와 성분별 허브
 */
export function computeRadialLayout(
  items: LayoutItem[],
  links: LayoutLink[],
  options: RadialLayoutOptions = {},
): RadialLayoutResult {
  const aspect =
    options.targetAspect !== undefined && options.targetAspect > 0
      ? options.targetAspect
      : DEFAULT_RADIAL_ASPECT;
  const threshold = options.largeGraphThreshold ?? DEFAULT_LARGE_GRAPH_THRESHOLD;
  const scales = items.length > threshold ? LARGE_GRAPH_SEED_SCALES : DEFAULT_SEED_SCALES;
  const sizes = new Map(items.map((item) => [item.id, item]));
  const graph: LayoutGraph = buildLayoutGraph(
    items.map((item) => item.id),
    links,
  );
  const preferred = new Set(options.preferredHubIds ?? []);
  const hubIds: string[] = [];
  const placements: ComponentPlacement[] = [];

  const areaOf = (component: string[]) =>
    component.reduce(
      (sum, id) => sum + (sizes.get(id)?.width ?? 0) * (sizes.get(id)?.height ?? 0),
      0,
    );
  const components = findConnectedComponents(graph)
    .map((component) => ({ component, area: areaOf(component) }))
    .sort(
      (left, right) => right.component.length - left.component.length || right.area - left.area,
    );

  components.forEach(({ component }) => {
    const hubId = selectHub(component, graph, preferred);
    hubIds.push(hubId);
    if (component.length === 1) {
      const size = sizes.get(hubId);
      if (size) placements.push(layoutSingleNode(size));
      return;
    }

    const seeds = computeRadialSeeds(component, hubId, graph, sizes, {
      gap: RADIAL_NODE_GAP,
      aspect,
    });
    placements.push(
      layoutComponentFromSeeds(seeds, sizes, graph, { nodeGap: RADIAL_NODE_GAP, scales, aspect }),
    );
  });

  const packed = packComponentsCircularly(placements, {
    componentGap: RADIAL_COMPONENT_GAP,
    aspect,
  });
  const minX = Math.min(...[...packed.values()].map((position) => position.x));
  const minY = Math.min(...[...packed.values()].map((position) => position.y));
  const positions = new Map(
    [...packed.entries()].map(([id, position]) => [
      id,
      { x: position.x - minX + RADIAL_LAYOUT_MARGIN, y: position.y - minY + RADIAL_LAYOUT_MARGIN },
    ]),
  );

  return { positions, hubIds };
}
