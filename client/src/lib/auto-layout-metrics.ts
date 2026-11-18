/** 자동정렬 품질 측정에 쓰는 직사각형 (좌상단 기준) */
export interface MetricBox {
  /** 노드 식별자 */
  id: string;
  /** 좌상단 x */
  x: number;
  /** 좌상단 y */
  y: number;
  /** 폭 */
  width: number;
  /** 높이 */
  height: number;
}

/** 두 노드를 잇는 관계 (방향 무관) */
export interface MetricLink {
  /** 한쪽 노드 id */
  source: string;
  /** 다른 쪽 노드 id */
  target: string;
}

/** 평면 위의 점 */
interface Point {
  x: number;
  y: number;
}

/** 원 (중심과 반지름) */
interface Circle {
  x: number;
  y: number;
  radius: number;
}

/** 자동정렬 품질 지표 모음 */
export interface LayoutMetrics {
  /** 전체 외곽 사각형의 종횡비 max(W/H, H/W) */
  aspectRatio: number;
  /** 모든 꼭짓점을 감싸는 최소 외접원 반지름 */
  enclosingRadius: number;
  /** 원 채움률 ΣA / (πR²) */
  circleFill: number;
  /** 윤곽(볼록껍질) 원형도 4πA / P² */
  hullCircularity: number;
  /** 주허브 중심 이탈 비율 ‖c_h − μ‖ / R (허브 미지정이면 null) */
  hubOffsetRatio: number | null;
  /** 모든 쌍의 겹침 면적 합 */
  overlapArea: number;
  /** 평균 엣지 길이 (중심 간 거리, 중복·자기참조 제거) */
  averageEdgeLength: number;
  /** 최대 엣지 길이 */
  maxEdgeLength: number;
  /** 끝점을 공유하지 않는 엣지 쌍의 교차 수 (중심 간 직선 기준) */
  edgeCrossings: number;
}

/** 최소 외접원 계산에서 쓰는 결정적 셔플용 LCG 상수 */
const LCG_MULTIPLIER = 1664525;
/** LCG 증분 */
const LCG_INCREMENT = 1013904223;
/** LCG 모듈러 (2^32) */
const LCG_MODULUS = 4294967296;
/** 원 포함 판정 허용 오차 */
const CIRCLE_EPSILON = 1e-7;

/**
 * 직사각형의 중심 좌표를 구한다.
 *
 * @param box 대상 직사각형
 * @returns 중심점
 */
function centerOf(box: MetricBox): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * 모든 직사각형의 꼭짓점을 모은다.
 *
 * @param boxes 직사각형 목록
 * @returns 꼭짓점 목록
 */
function collectCorners(boxes: MetricBox[]): Point[] {
  return boxes.flatMap((box) => [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height },
  ]);
}

/**
 * 외적 부호로 점들의 볼록껍질(반시계)을 계산한다.
 *
 * @param points 점 목록
 * @returns 볼록껍질 꼭짓점 (반시계)
 */
export function computeConvexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y);
  const unique = sorted.filter(
    (point, index) =>
      index === 0 || point.x !== sorted[index - 1].x || point.y !== sorted[index - 1].y,
  );
  if (unique.length <= 2) {
    return unique;
  }

  const cross = (origin: Point, left: Point, right: Point): number =>
    (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
  const buildChain = (ordered: Point[]): Point[] => {
    const chain: Point[] = [];
    ordered.forEach((point) => {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0
      ) {
        chain.pop();
      }
      chain.push(point);
    });
    chain.pop();
    return chain;
  };

  return [...buildChain(unique), ...buildChain([...unique].reverse())];
}

/**
 * 다각형의 면적과 둘레를 계산한다.
 *
 * @param polygon 순서가 있는 꼭짓점
 * @returns 면적과 둘레
 */
function measurePolygon(polygon: Point[]): { area: number; perimeter: number } {
  let doubledArea = 0;
  let perimeter = 0;
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    doubledArea += point.x * next.y - next.x * point.y;
    perimeter += Math.hypot(next.x - point.x, next.y - point.y);
  });
  return { area: Math.abs(doubledArea) / 2, perimeter };
}

/**
 * 점이 원 안에 있는지 판정한다.
 *
 * @param circle 원
 * @param point 점
 * @returns 포함 여부
 */
function circleContains(circle: Circle, point: Point): boolean {
  return Math.hypot(point.x - circle.x, point.y - circle.y) <= circle.radius + CIRCLE_EPSILON;
}

/**
 * 두 점을 지름으로 하는 원을 만든다.
 *
 * @param left 점 1
 * @param right 점 2
 * @returns 원
 */
function circleFromTwo(left: Point, right: Point): Circle {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    radius: Math.hypot(left.x - right.x, left.y - right.y) / 2,
  };
}

/**
 * 세 점을 지나는 원을 만든다 (일직선이면 가장 먼 두 점의 원).
 *
 * @param first 점 1
 * @param second 점 2
 * @param third 점 3
 * @returns 원
 */
function circleFromThree(first: Point, second: Point, third: Point): Circle {
  const determinant =
    2 *
    (first.x * (second.y - third.y) +
      second.x * (third.y - first.y) +
      third.x * (first.y - second.y));
  if (Math.abs(determinant) < CIRCLE_EPSILON) {
    const candidates = [
      circleFromTwo(first, second),
      circleFromTwo(first, third),
      circleFromTwo(second, third),
    ];
    return candidates.reduce((best, candidate) =>
      candidate.radius > best.radius ? candidate : best,
    );
  }

  const firstSquare = first.x * first.x + first.y * first.y;
  const secondSquare = second.x * second.x + second.y * second.y;
  const thirdSquare = third.x * third.x + third.y * third.y;
  const x =
    (firstSquare * (second.y - third.y) +
      secondSquare * (third.y - first.y) +
      thirdSquare * (first.y - second.y)) /
    determinant;
  const y =
    (firstSquare * (third.x - second.x) +
      secondSquare * (first.x - third.x) +
      thirdSquare * (second.x - first.x)) /
    determinant;
  return { x, y, radius: Math.hypot(first.x - x, first.y - y) };
}

/**
 * 결정적 의사난수로 점 순서를 섞는다 (Welzl 기대 선형 시간 보장용).
 *
 * @param points 점 목록
 * @returns 섞인 새 배열
 */
function shuffleDeterministically(points: Point[]): Point[] {
  const shuffled = [...points];
  let state = shuffled.length + 1;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/**
 * 점 집합의 최소 외접원을 반복형 Welzl 알고리즘으로 구한다.
 *
 * @param points 점 목록
 * @returns 최소 외접원 (점이 없으면 반지름 0)
 */
export function computeMinimumEnclosingCircle(points: Point[]): Circle {
  const shuffled = shuffleDeterministically(points);
  let circle: Circle = { x: 0, y: 0, radius: 0 };
  if (shuffled.length === 0) {
    return circle;
  }

  circle = { x: shuffled[0].x, y: shuffled[0].y, radius: 0 };
  for (let first = 1; first < shuffled.length; first += 1) {
    if (circleContains(circle, shuffled[first])) continue;
    circle = { x: shuffled[first].x, y: shuffled[first].y, radius: 0 };
    for (let second = 0; second < first; second += 1) {
      if (circleContains(circle, shuffled[second])) continue;
      circle = circleFromTwo(shuffled[first], shuffled[second]);
      for (let third = 0; third < second; third += 1) {
        if (circleContains(circle, shuffled[third])) continue;
        circle = circleFromThree(shuffled[first], shuffled[second], shuffled[third]);
      }
    }
  }
  return circle;
}

/**
 * 두 직사각형이 겹치는 면적을 구한다.
 *
 * @param left 직사각형 1
 * @param right 직사각형 2
 * @returns 겹침 면적 (겹치지 않으면 0)
 */
export function computeOverlapArea(left: MetricBox, right: MetricBox): number {
  const overlapWidth =
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
  const overlapHeight =
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);
  return overlapWidth > 0 && overlapHeight > 0 ? overlapWidth * overlapHeight : 0;
}

/**
 * 중복·자기참조·미존재 노드를 제거한 무방향 관계 쌍을 만든다.
 *
 * @param boxesById 노드 id별 직사각형
 * @param links 관계 목록
 * @returns 정렬된 고유 쌍 키로 중복이 제거된 관계 목록
 */
export function uniqueLinks(
  boxesById: Map<string, MetricBox>,
  links: MetricLink[],
): Array<[MetricBox, MetricBox]> {
  const seen = new Set<string>();
  const pairs: Array<[MetricBox, MetricBox]> = [];
  links.forEach((link) => {
    const source = boxesById.get(link.source);
    const target = boxesById.get(link.target);
    if (!source || !target || source.id === target.id) return;
    const key =
      source.id < target.id ? `${source.id}\u0000${target.id}` : `${target.id}\u0000${source.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([source, target]);
  });
  return pairs;
}

/**
 * 세 점의 방향(외적 부호)을 구한다.
 *
 * @param origin 기준점
 * @param left 점 1
 * @param right 점 2
 * @returns 양수 = 반시계, 음수 = 시계, 0 = 일직선
 */
function orientation(origin: Point, left: Point, right: Point): number {
  return Math.sign(
    (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x),
  );
}

/**
 * 끝점을 공유하지 않는 엣지 쌍 중 중심 간 직선이 서로 교차하는 수를 센다.
 *
 * @param pairs 고유 관계 쌍
 * @returns 교차 수
 */
export function countEdgeCrossings(pairs: Array<[MetricBox, MetricBox]>): number {
  let crossings = 0;
  for (let left = 0; left < pairs.length; left += 1) {
    for (let right = left + 1; right < pairs.length; right += 1) {
      const [firstSource, firstTarget] = pairs[left];
      const [secondSource, secondTarget] = pairs[right];
      const ids = new Set([firstSource.id, firstTarget.id, secondSource.id, secondTarget.id]);
      if (ids.size < 4) continue;

      const a = centerOf(firstSource);
      const b = centerOf(firstTarget);
      const c = centerOf(secondSource);
      const d = centerOf(secondTarget);
      if (
        orientation(a, b, c) * orientation(a, b, d) < 0 &&
        orientation(c, d, a) * orientation(c, d, b) < 0
      ) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

/**
 * 자동정렬 결과의 품질 지표를 계산한다 (종횡비, 원 채움률, 윤곽 원형도, 허브 중심성, 겹침, 엣지 길이).
 *
 * @param boxes 배치된 직사각형 목록
 * @param links 관계 목록
 * @param hubId 허브 중심성을 평가할 노드 id (선택)
 * @returns 지표 모음
 */
export function measureLayoutMetrics(
  boxes: MetricBox[],
  links: MetricLink[],
  hubId?: string,
): LayoutMetrics {
  if (boxes.length === 0) {
    return {
      aspectRatio: 1,
      enclosingRadius: 0,
      circleFill: 0,
      hullCircularity: 0,
      hubOffsetRatio: null,
      overlapArea: 0,
      averageEdgeLength: 0,
      maxEdgeLength: 0,
      edgeCrossings: 0,
    };
  }

  const corners = collectCorners(boxes);
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  const width = maxX - minX;
  const height = maxY - minY;
  const aspectRatio = width === 0 || height === 0 ? 1 : Math.max(width / height, height / width);

  const hull = computeConvexHull(corners);
  const enclosing = computeMinimumEnclosingCircle(hull);
  const totalArea = boxes.reduce((sum, box) => sum + box.width * box.height, 0);
  const circleFill = enclosing.radius === 0 ? 0 : totalArea / (Math.PI * enclosing.radius ** 2);
  const hullShape = hull.length >= 3 ? measurePolygon(hull) : { area: 0, perimeter: 0 };
  const hullCircularity =
    hullShape.perimeter === 0 ? 0 : (4 * Math.PI * hullShape.area) / hullShape.perimeter ** 2;

  let hubOffsetRatio: number | null = null;
  const hubBox = hubId === undefined ? undefined : boxes.find((box) => box.id === hubId);
  if (hubBox && enclosing.radius > 0) {
    const centroid = boxes.reduce(
      (sum, box) => {
        const center = centerOf(box);
        const area = box.width * box.height;
        return { x: sum.x + center.x * area, y: sum.y + center.y * area };
      },
      { x: 0, y: 0 },
    );
    const hubCenter = centerOf(hubBox);
    hubOffsetRatio =
      Math.hypot(hubCenter.x - centroid.x / totalArea, hubCenter.y - centroid.y / totalArea) /
      enclosing.radius;
  }

  let overlapArea = 0;
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      overlapArea += computeOverlapArea(boxes[left], boxes[right]);
    }
  }

  const linkPairs = uniqueLinks(new Map(boxes.map((box) => [box.id, box])), links);
  const edgeLengths = linkPairs.map(([source, target]) => {
    const from = centerOf(source);
    const to = centerOf(target);
    return Math.hypot(from.x - to.x, from.y - to.y);
  });

  return {
    aspectRatio,
    enclosingRadius: enclosing.radius,
    circleFill,
    hullCircularity,
    hubOffsetRatio,
    overlapArea,
    averageEdgeLength:
      edgeLengths.length === 0
        ? 0
        : edgeLengths.reduce((sum, length) => sum + length, 0) / edgeLengths.length,
    maxEdgeLength: edgeLengths.length === 0 ? 0 : Math.max(...edgeLengths),
    edgeCrossings: countEdgeCrossings(linkPairs),
  };
}
