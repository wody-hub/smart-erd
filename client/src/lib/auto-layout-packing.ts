import { computeMinimumEnclosingCircle } from './auto-layout-metrics.js';
import type { LayoutGraph, LayoutItem, RadialSeed } from './auto-layout-radial.js';

/** 충돌 검사용 배치된 직사각형 (좌상단 기준, 정수 좌표) */
export interface PlacedBox {
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
  /** 공간 인덱스 중복 방문 방지용 질의 번호 */
  mark: number;
}

/** 한 연결 성분의 상대 배치 (원점 = 외접원 중심) */
export interface ComponentPlacement {
  /** 성분 노드 박스 */
  boxes: PlacedBox[];
  /** 최소 외접원 반지름 */
  radius: number;
}

/** 시드 압축 배율 후보와 간격 등 성분 배치 옵션 */
export interface ComponentLayoutOptions {
  /** 노드 사이 최소 간격 */
  nodeGap: number;
  /** 시드 압축 배율 후보 */
  scales: number[];
  /** 가로/세로 타원 비율 */
  aspect: number;
}

/** 성분 패킹 옵션 */
export interface PackingOptions {
  /** 성분 사이 최소 간격 */
  componentGap: number;
  /** 가로/세로 타원 비율 */
  aspect: number;
}

/** 2차원 점 */
interface Point {
  x: number;
  y: number;
}

/** 공간 인덱스 셀 크기 */
const GRID_CELL_SIZE = 1024;
/** 셀 키 계산 시 음수 방지 오프셋 */
const GRID_KEY_OFFSET = 100_000;
/** 셀 키 계산 stride */
const GRID_KEY_STRIDE = 200_000;
/** 후보 좌표 생성에 쓰는 가장 가까운 기준 박스 수의 초기값 */
const NEAREST_BOX_COUNT = 8;
/** 시드 목표 거리 가중치 */
const TARGET_DISTANCE_WEIGHT = 1;
/** 배치된 이웃과의 거리 가중치 (엣지 길이 축소) */
const NEIGHBOR_DISTANCE_WEIGHT = 0.5;
/** 허브 중심 이탈 가중치 (성분 외접 반지름 대비 px) */
const HUB_OFFSET_WEIGHT = 1;
/** 가까운 박스 기준 후보 생성의 최대 반복 횟수 (매번 기준 박스 수를 두 배로) */
const MAX_REFERENCE_ROUNDS = 3;
/** 바깥 방향 탐색에서 시도하는 방향 수 */
const RAY_COUNT = 8;
/** 바깥 방향 탐색의 걸음 길이 */
const RAY_STEP = 80;
/** 바깥 방향 탐색의 최대 걸음 수 */
const RAY_MAX_STEPS = 600;
/** 접점 이분 탐색 반복 횟수 */
const RAY_REFINE_ITERATIONS = 6;
/** 종횡비 오차(로그) 페널티 가중치 */
const ASPECT_PENALTY_WEIGHT = 0.5;
/** 나선 탐색 최대 단계 수 */
const MAX_SPIRAL_STEPS = 60_000;
/** 나선 호 길이 단계 최소값 */
const MIN_ARC_STEP = 60;
/** 나선 호 길이 단계 최대값 */
const MAX_ARC_STEP = 400;
/** 나선 호 길이 단계 = 성분 반지름 / 이 값 */
const ARC_STEP_DIVISOR = 6;
/** 나선 한 바퀴당 반지름 증가 최소값 */
const MIN_SPIRAL_PITCH = 120;
/** 나선 한 바퀴당 반지름 증가 최대값 */
const MAX_SPIRAL_PITCH = 800;
/** 나선 피치 = 성분 반지름 / 이 값 */
const PITCH_DIVISOR = 2;
/** 빈자리를 찾은 뒤 중심 쪽으로 미는 단계 */
const SLIDE_STEP = 40;
/** 황금각 (성분마다 나선 시작 각도를 분산) */
const GOLDEN_ANGLE = 2.399963229728653;
/** 나선 시작 반지름을 성분 직경만큼 되돌리는 배수 */
const SPIRAL_BACKOFF_FACTOR = 2;

/** 정수 좌표 박스 충돌 검사를 위한 균일 격자 공간 인덱스 */
export class BoxGrid {
  /** 셀별 박스 목록 */
  private readonly cells = new Map<number, PlacedBox[]>();

  /** 질의 번호 (중복 방문 제거) */
  private queryCounter = 0;

  /** 삽입된 전체 박스 */
  readonly boxes: PlacedBox[] = [];

  /**
   * 셀 키를 만든다.
   *
   * @param cellX 셀 x 인덱스
   * @param cellY 셀 y 인덱스
   * @returns 숫자 키
   */
  private static keyOf(cellX: number, cellY: number): number {
    return (cellX + GRID_KEY_OFFSET) * GRID_KEY_STRIDE + (cellY + GRID_KEY_OFFSET);
  }

  /**
   * 박스를 인덱스에 추가한다.
   *
   * @param box 배치된 박스
   * @returns 없음
   */
  insert(box: PlacedBox): void {
    this.boxes.push(box);
    const lastX = Math.floor((box.x + box.width - 1) / GRID_CELL_SIZE);
    const lastY = Math.floor((box.y + box.height - 1) / GRID_CELL_SIZE);
    for (let cellX = Math.floor(box.x / GRID_CELL_SIZE); cellX <= lastX; cellX += 1) {
      for (let cellY = Math.floor(box.y / GRID_CELL_SIZE); cellY <= lastY; cellY += 1) {
        const key = BoxGrid.keyOf(cellX, cellY);
        const cell = this.cells.get(key);
        if (cell) {
          cell.push(box);
        } else {
          this.cells.set(key, [box]);
        }
      }
    }
  }

  /**
   * 직사각형을 gap 이상 떨어뜨려 놓을 수 있는지 검사한다.
   *
   * @param x 좌상단 x
   * @param y 좌상단 y
   * @param width 폭
   * @param height 높이
   * @param gap 다른 박스와의 최소 간격
   * @returns 모든 박스와 gap 이상 떨어져 있으면 true
   */
  isFree(x: number, y: number, width: number, height: number, gap: number): boolean {
    const left = x - gap;
    const top = y - gap;
    const right = x + width + gap;
    const bottom = y + height + gap;
    this.queryCounter += 1;

    const lastX = Math.floor((right - 1) / GRID_CELL_SIZE);
    const lastY = Math.floor((bottom - 1) / GRID_CELL_SIZE);
    for (let cellX = Math.floor(left / GRID_CELL_SIZE); cellX <= lastX; cellX += 1) {
      for (let cellY = Math.floor(top / GRID_CELL_SIZE); cellY <= lastY; cellY += 1) {
        const cell = this.cells.get(BoxGrid.keyOf(cellX, cellY));
        if (!cell) continue;
        for (const box of cell) {
          if (box.mark === this.queryCounter) continue;
          box.mark = this.queryCounter;
          if (
            box.x < right &&
            box.x + box.width > left &&
            box.y < bottom &&
            box.y + box.height > top
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * 삽입된 모든 박스를 감싸는 경계를 구한다.
   *
   * @returns 경계 (박스가 없으면 0)
   */
  getBounds(): { left: number; top: number; right: number; bottom: number } {
    if (this.boxes.length === 0) return { left: 0, top: 0, right: 0, bottom: 0 };
    return {
      left: Math.min(...this.boxes.map((box) => box.x)),
      top: Math.min(...this.boxes.map((box) => box.y)),
      right: Math.max(...this.boxes.map((box) => box.x + box.width)),
      bottom: Math.max(...this.boxes.map((box) => box.y + box.height)),
    };
  }
}

/**
 * 목표 중심점에서 가장 가까운 배치된 박스 k개를 고른다.
 *
 * @param boxes 배치된 박스
 * @param target 목표 중심점
 * @param count 고를 개수
 * @returns 가까운 순 박스 (동률은 삽입 순서)
 */
function pickNearestBoxes(boxes: PlacedBox[], target: Point, count: number): PlacedBox[] {
  const nearest: Array<{ box: PlacedBox; distance: number }> = [];
  for (const box of boxes) {
    const dx = Math.max(box.x - target.x, 0, target.x - (box.x + box.width));
    const dy = Math.max(box.y - target.y, 0, target.y - (box.y + box.height));
    const distance = dx * dx + dy * dy;
    if (nearest.length >= count && distance >= nearest[nearest.length - 1].distance) continue;

    let position = nearest.length;
    while (position > 0 && nearest[position - 1].distance > distance) position -= 1;
    nearest.splice(position, 0, { box, distance });
    if (nearest.length > count) nearest.pop();
  }
  return nearest.map((entry) => entry.box);
}

/**
 * 비용이 낮은 후보부터 충돌 없는 첫 후보를 찾는다.
 *
 * 비용(1px 단위 내림)과 후보 번호를 한 숫자로 묶어 네이티브 정렬로 비용 순서를 만든다. 동률은 후보 번호(작은 x, 작은 y) 순이다.
 *
 * @param grid 공간 인덱스
 * @param costs 후보별 비용 (x 인덱스 * y 개수 + y 인덱스)
 * @param xValues 후보 x 좌표 (오름차순)
 * @param yValues 후보 y 좌표 (오름차순)
 * @param item 배치할 노드 크기
 * @param gap 최소 간격
 * @returns 충돌 없는 최저 비용 좌상단 좌표 (없으면 null)
 */
function pickCheapestFreeCandidate(
  grid: BoxGrid,
  costs: Float64Array,
  xValues: number[],
  yValues: number[],
  item: LayoutItem,
  gap: number,
): Point | null {
  const keys = new Float64Array(costs.length);
  for (let index = 0; index < costs.length; index += 1) {
    keys[index] = Math.floor(costs[index]) * costs.length + index;
  }
  keys.sort();

  for (const key of keys) {
    const index = key % costs.length;
    const x = xValues[Math.floor(index / yValues.length)];
    const y = yValues[index % yValues.length];
    if (grid.isFree(x, y, item.width, item.height, gap)) return { x, y };
  }
  return null;
}

/**
 * 목표점에 가장 가깝고 충돌 없는 좌상단 좌표를 찾는다.
 *
 * 가까운 박스들의 변에 맞닿는 좌표 조합을 후보로 삼고, 시드 목표 거리와 이웃 거리의 가중합이 최소인 후보를 고른다.
 * 후보가 모두 충돌하면 기준 박스 수를 두 배로 늘리고, 끝까지 없으면 전체 경계 오른쪽에 둔다.
 *
 * @param grid 공간 인덱스
 * @param item 배치할 노드 크기
 * @param target 목표 중심점
 * @param neighborCenters 이미 배치된 이웃의 중심점
 * @param gap 최소 간격
 * @param outwardPoint 시드 방향으로 현재 덩어리 바깥 경계에 놓은 기준점 (후보 좌표 생성에 함께 쓴다)
 * @returns 좌상단 좌표
 */
export function findNearestFreePosition(
  grid: BoxGrid,
  item: LayoutItem,
  target: Point,
  neighborCenters: Point[],
  gap: number,
  outwardPoint: Point = target,
): Point {
  const { width, height } = item;
  const evaluate = (x: number, y: number): number => {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const toTarget = Math.hypot(centerX - target.x, centerY - target.y);
    const toNeighbors = neighborCenters.reduce(
      (sum, neighbor) => sum + Math.hypot(centerX - neighbor.x, centerY - neighbor.y),
      0,
    );
    return TARGET_DISTANCE_WEIGHT * toTarget + NEIGHBOR_DISTANCE_WEIGHT * toNeighbors;
  };

  let count = NEAREST_BOX_COUNT;
  for (let round = 0; round < MAX_REFERENCE_ROUNDS; round += 1, count *= 2) {
    const references = pickNearestBoxes(grid.boxes, target, count);
    const xs = new Set<number>([Math.round(target.x - width / 2)]);
    const ys = new Set<number>([Math.round(target.y - height / 2)]);
    references.forEach((box) => {
      xs.add(box.x + box.width + gap);
      xs.add(box.x - gap - width);
      ys.add(box.y + box.height + gap);
      ys.add(box.y - gap - height);
    });

    const xValues = [...xs].sort((left, right) => left - right);
    const yValues = [...ys].sort((left, right) => left - right);
    const costs = new Float64Array(xValues.length * yValues.length);
    xValues.forEach((x, xIndex) => {
      yValues.forEach((y, yIndex) => {
        costs[xIndex * yValues.length + yIndex] = evaluate(x, y);
      });
    });

    const feasible = pickCheapestFreeCandidate(grid, costs, xValues, yValues, item, gap);
    if (feasible) {
      return feasible;
    }
    if (count >= grid.boxes.length) break;
  }

  return searchOutwardRays(grid, item, target, outwardPoint, gap, evaluate);
}

/**
 * 한 방향으로 한 걸음씩 나아가 처음 충돌이 없는 위치를 찾고, 이분 탐색으로 중심 쪽 접점에 붙인다.
 *
 * @param grid 공간 인덱스
 * @param item 배치할 노드 크기
 * @param origin 출발 중심점
 * @param angle 진행 각도 (라디안)
 * @param gap 최소 간격
 * @returns 좌상단 좌표 (끝까지 막혀 있으면 null)
 */
function marchAlongRay(
  grid: BoxGrid,
  item: LayoutItem,
  origin: Point,
  angle: number,
  gap: number,
): Point | null {
  const { width, height } = item;
  /**
   * 출발점에서 distance만큼 나아간 중심에 노드를 놓았을 때의 좌상단 좌표를 구한다.
   *
   * @param distance 진행 거리
   * @returns 좌상단 좌표
   */
  const positionAt = (distance: number): Point => ({
    x: Math.round(origin.x + Math.cos(angle) * distance - width / 2),
    y: Math.round(origin.y + Math.sin(angle) * distance - height / 2),
  });

  for (let step = 0; step <= RAY_MAX_STEPS; step += 1) {
    const distance = step * RAY_STEP;
    const found = positionAt(distance);
    if (!grid.isFree(found.x, found.y, width, height, gap)) continue;

    let low = Math.max(0, distance - RAY_STEP);
    let high = distance;
    for (let iteration = 0; iteration < RAY_REFINE_ITERATIONS; iteration += 1) {
      const middle = (low + high) / 2;
      const probe = positionAt(middle);
      if (grid.isFree(probe.x, probe.y, width, height, gap)) {
        high = middle;
      } else {
        low = middle;
      }
    }
    return positionAt(high);
  }
  return null;
}

/**
 * 시드 방향을 기준으로 여러 방향의 바깥 탐색을 하고 비용이 가장 낮은 접점을 고른다.
 *
 * 가까운 박스 기준 후보가 모두 막힌 조밀한 덩어리에서도 빈자리를 보장하는 마지막 수단이다.
 * 끝까지 막혀 있으면 전체 경계 오른쪽에 둔다.
 *
 * @param grid 공간 인덱스
 * @param item 배치할 노드 크기
 * @param target 목표 중심점
 * @param outwardPoint 바깥 방향 기준점
 * @param gap 최소 간격
 * @param evaluate 좌상단 좌표의 비용 함수
 * @returns 좌상단 좌표
 */
function searchOutwardRays(
  grid: BoxGrid,
  item: LayoutItem,
  target: Point,
  outwardPoint: Point,
  gap: number,
  evaluate: (x: number, y: number) => number,
): Point {
  const baseAngle = Math.atan2(outwardPoint.y - target.y, outwardPoint.x - target.x);
  let best: Point | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let ray = 0; ray < RAY_COUNT; ray += 1) {
    const found = marchAlongRay(
      grid,
      item,
      target,
      baseAngle + (ray * Math.PI * 2) / RAY_COUNT,
      gap,
    );
    if (!found) continue;
    const cost = evaluate(found.x, found.y);
    if (cost < bestCost) {
      best = found;
      bestCost = cost;
    }
  }

  if (best) return best;
  const bounds = grid.getBounds();
  return { x: bounds.right + gap, y: Math.round(target.y - item.height / 2) };
}

/**
 * 성분 박스들의 최소 외접원을 구한다.
 *
 * @param boxes 박스 목록
 * @returns 외접원 (중심과 반지름)
 */
function enclosingCircleOf(boxes: PlacedBox[]): { x: number; y: number; radius: number } {
  return computeMinimumEnclosingCircle(
    boxes.flatMap((box) => [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x, y: box.y + box.height },
      { x: box.x + box.width, y: box.y + box.height },
    ]),
  );
}

/**
 * 박스 꼭짓점 중 원점에서 가장 먼 거리를 구한다.
 *
 * @param box 박스
 * @returns 원점으로부터 최대 꼭짓점 거리
 */
function farthestCornerDistance(box: PlacedBox): number {
  const farthestX = Math.max(Math.abs(box.x), Math.abs(box.x + box.width));
  const farthestY = Math.max(Math.abs(box.y), Math.abs(box.y + box.height));
  return Math.hypot(farthestX, farthestY);
}

/**
 * 시드 방향으로 현재 덩어리 바깥 경계에 놓은 기준점을 구한다.
 *
 * @param seed 시드 (허브 중심 기준)
 * @param blobRadius 지금까지 배치된 박스의 최대 꼭짓점 반지름
 * @returns 기준점
 */
function outwardPointOf(seed: RadialSeed, blobRadius: number): Point {
  const length = Math.hypot(seed.x, seed.y);
  if (length === 0) return { x: 0, y: 0 };
  return {
    x: Math.round((seed.x / length) * blobRadius),
    y: Math.round((seed.y / length) * blobRadius),
  };
}

/**
 * 시드를 scale배로 압축한 목표점에 가장 가까운 충돌 없는 위치로 BFS 순서대로 합법화한다.
 *
 * @param seeds BFS 순서 시드 (첫 원소 = 허브)
 * @param sizes 노드 크기
 * @param graph 그래프 색인
 * @param scale 시드 압축 배율
 * @param options 간격과 타원 비율
 * @returns 허브 중심이 원점인 박스 목록
 */
function legalizeSeeds(
  seeds: RadialSeed[],
  sizes: Map<string, LayoutItem>,
  graph: LayoutGraph,
  scale: number,
  options: ComponentLayoutOptions,
): PlacedBox[] {
  const grid = new BoxGrid();
  const placedById = new Map<string, PlacedBox>();
  let blobRadius = 0;

  seeds.forEach((seed, index) => {
    const size = sizes.get(seed.id);
    if (!size) return;
    const target = { x: Math.round(seed.x * scale), y: Math.round(seed.y * scale) };
    const position =
      index === 0
        ? { x: -Math.floor(size.width / 2), y: -Math.floor(size.height / 2) }
        : findNearestFreePosition(
            grid,
            size,
            target,
            (graph.neighbors.get(seed.id) ?? []).flatMap((neighborId) => {
              const neighbor = placedById.get(neighborId);
              return neighbor
                ? [{ x: neighbor.x + neighbor.width / 2, y: neighbor.y + neighbor.height / 2 }]
                : [];
            }),
            options.nodeGap,
            outwardPointOf(seed, blobRadius),
          );
    const box: PlacedBox = {
      id: seed.id,
      ...position,
      width: size.width,
      height: size.height,
      mark: 0,
    };
    blobRadius = Math.max(blobRadius, farthestCornerDistance(box));
    placedById.set(seed.id, box);
    grid.insert(box);
  });

  return grid.boxes;
}

/**
 * 성분 배치의 품질 비용을 계산한다 (외접 반지름 x 종횡비 페널티 + 허브 중심 이탈).
 *
 * @param boxes 박스 목록 (첫 박스 = 허브)
 * @param aspect 목표 가로/세로 비율 (W/H)
 * @returns 작을수록 좋은 비용
 */
function scoreComponent(boxes: PlacedBox[], aspect: number): number {
  const circle = enclosingCircleOf(boxes);
  const hub = boxes[0];
  const hubOffset = Math.hypot(hub.x + hub.width / 2 - circle.x, hub.y + hub.height / 2 - circle.y);
  const width =
    Math.max(...boxes.map((box) => box.x + box.width)) - Math.min(...boxes.map((box) => box.x));
  const height =
    Math.max(...boxes.map((box) => box.y + box.height)) - Math.min(...boxes.map((box) => box.y));
  const aspectError = Math.abs(Math.log(width / height / aspect));
  return circle.radius * (1 + ASPECT_PENALTY_WEIGHT * aspectError) + HUB_OFFSET_WEIGHT * hubOffset;
}

/**
 * 한 성분을 방사형 시드 기반으로 배치하고 외접원 중심이 원점이 되도록 정규화한다.
 *
 * 시드 압축 배율 후보마다 합법화한 뒤 외접 반지름과 허브 중심 이탈이 가장 작은 결과를 채택한다.
 *
 * @param seeds BFS 순서 시드 (첫 원소 = 허브)
 * @param sizes 노드 크기
 * @param graph 그래프 색인
 * @param options 간격, 압축 배율 후보, 타원 비율
 * @returns 성분 상대 배치
 */
export function layoutComponentFromSeeds(
  seeds: RadialSeed[],
  sizes: Map<string, LayoutItem>,
  graph: LayoutGraph,
  options: ComponentLayoutOptions,
): ComponentPlacement {
  let bestBoxes: PlacedBox[] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  options.scales.forEach((scale) => {
    const boxes = legalizeSeeds(seeds, sizes, graph, scale, options);
    const score = scoreComponent(boxes, options.aspect);
    if (score < bestScore) {
      bestScore = score;
      bestBoxes = boxes;
    }
  });

  const circle = enclosingCircleOf(bestBoxes);
  const shiftX = Math.round(circle.x);
  const shiftY = Math.round(circle.y);
  return {
    boxes: bestBoxes.map((box) => ({ ...box, x: box.x - shiftX, y: box.y - shiftY, mark: 0 })),
    radius: circle.radius,
  };
}

/**
 * 단일 노드 성분의 배치를 만든다.
 *
 * @param item 노드 크기
 * @returns 성분 상대 배치
 */
export function layoutSingleNode(item: LayoutItem): ComponentPlacement {
  return {
    boxes: [
      {
        id: item.id,
        x: -Math.floor(item.width / 2),
        y: -Math.floor(item.height / 2),
        width: item.width,
        height: item.height,
        mark: 0,
      },
    ],
    radius: Math.hypot(item.width, item.height) / 2,
  };
}

/**
 * 성분 박스 전체를 오프셋만큼 옮겨도 충돌이 없는지 검사한다.
 *
 * @param grid 공간 인덱스
 * @param boxes 성분 박스
 * @param offsetX x 이동량
 * @param offsetY y 이동량
 * @param gap 최소 간격
 * @returns 모두 비어 있으면 true
 */
function fitsAt(
  grid: BoxGrid,
  boxes: PlacedBox[],
  offsetX: number,
  offsetY: number,
  gap: number,
): boolean {
  return boxes.every((box) =>
    grid.isFree(box.x + offsetX, box.y + offsetY, box.width, box.height, gap),
  );
}

/**
 * 성분들을 원형으로 패킹한다. 첫 성분(주성분)을 중앙에 두고 나머지는 실제 노드 충돌 기준 나선 후보에 놓는다.
 *
 * 빈자리를 찾으면 중심 방향으로 한 단계씩 밀어 넣어 빈 공간을 줄인다. 모든 좌표는 정수다.
 *
 * @param components 정렬된 성분 배치 (큰 성분이 앞)
 * @param options 성분 간격과 타원 비율
 * @returns 노드 id별 좌상단 좌표
 */
export function packComponentsCircularly(
  components: ComponentPlacement[],
  options: PackingOptions,
): Map<string, Point> {
  const grid = new BoxGrid();
  const positions = new Map<string, Point>();
  const ratioX = Math.sqrt(options.aspect);
  const ratioY = 1 / ratioX;
  let previousRadius = 0;

  components.forEach((component, index) => {
    let offset: Point = { x: 0, y: 0 };
    let foundRadius = 0;

    if (index > 0) {
      const arcStep = Math.min(
        MAX_ARC_STEP,
        Math.max(MIN_ARC_STEP, component.radius / ARC_STEP_DIVISOR),
      );
      const pitch = Math.min(
        MAX_SPIRAL_PITCH,
        Math.max(MIN_SPIRAL_PITCH, component.radius / PITCH_DIVISOR),
      );
      let theta = index * GOLDEN_ANGLE;
      let radius = Math.max(0, previousRadius - SPIRAL_BACKOFF_FACTOR * component.radius);
      let found = false;

      for (let step = 0; step < MAX_SPIRAL_STEPS && !found; step += 1) {
        const candidate = {
          x: Math.round(radius * Math.cos(theta) * ratioX),
          y: Math.round(radius * Math.sin(theta) * ratioY),
        };
        if (fitsAt(grid, component.boxes, candidate.x, candidate.y, options.componentGap)) {
          found = true;
          offset = candidate;
          foundRadius = radius;
        } else {
          const turn = arcStep / Math.max(radius, arcStep);
          theta += turn;
          radius += (pitch * turn) / (Math.PI * 2);
        }
      }

      if (found) {
        for (let slid = foundRadius - SLIDE_STEP; slid >= 0; slid -= SLIDE_STEP) {
          const candidate = {
            x: Math.round(slid * Math.cos(theta) * ratioX),
            y: Math.round(slid * Math.sin(theta) * ratioY),
          };
          if (!fitsAt(grid, component.boxes, candidate.x, candidate.y, options.componentGap)) break;
          offset = candidate;
          foundRadius = slid;
        }
      } else {
        const bounds = grid.getBounds();
        const leftEdge = Math.min(...component.boxes.map((box) => box.x));
        offset = { x: bounds.right + options.componentGap - leftEdge, y: 0 };
        foundRadius = Math.hypot(offset.x, offset.y);
      }
    }

    previousRadius = foundRadius;
    component.boxes.forEach((box) => {
      const placed: PlacedBox = { ...box, x: box.x + offset.x, y: box.y + offset.y, mark: 0 };
      positions.set(box.id, { x: placed.x, y: placed.y });
      grid.insert(placed);
    });
  });

  return positions;
}
