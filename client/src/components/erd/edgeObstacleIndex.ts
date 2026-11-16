import type { EdgeObstacleRect } from './edgeAutoRoute.js';
import type { EdgePoint } from './edgeWaypointGeometry.js';

/** 스냅샷의 원본/확장 장애물과 endpoint 제외용 식별자. */
export interface IndexedEdgeObstacle {
  nodeId?: string;
  raw: EdgeObstacleRect;
  expanded: EdgeObstacleRect;
}

/** 원본과 확장 사각형을 모두 포함하는 보수적 AABB 트리. */
export interface EdgeObstacleIndex {
  bounds: EdgeObstacleRect;
  children?: readonly [EdgeObstacleIndex, EdgeObstacleIndex];
  entries?: readonly IndexedEdgeObstacle[];
}

/**
 * 장애물을 x축으로 한 번 정렬한 뒤 균형 트리를 만든다. 입력 순서는 바꾸지 않는다.
 * @param entries 원본/확장 장애물
 * @returns O(N log N)에 구축한 공유 인덱스
 */
export function buildEdgeObstacleIndex(entries: readonly IndexedEdgeObstacle[]): EdgeObstacleIndex {
  const sorted = [...entries].sort((a, b) => a.raw.left - b.raw.left);
  return buildIndexRange(sorted, 0, sorted.length);
}

/**
 * 정렬된 구간을 재귀 분할한다. 비유한 좌표는 무한 bounds로 두어 절대 잘라내지 않는다.
 * @param entries 정렬된 장애물
 * @param start 포함 시작점
 * @param end 제외 끝점
 * @returns 구간의 인덱스
 */
function buildIndexRange(
  entries: IndexedEdgeObstacle[],
  start: number,
  end: number,
): EdgeObstacleIndex {
  if (end - start <= 8) {
    const leaf = entries.slice(start, end);
    const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const { raw, expanded } of leaf) {
      for (const rect of [raw, expanded]) {
        if (![rect.left, rect.right, rect.top, rect.bottom].every(Number.isFinite)) {
          return {
            bounds: { left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity },
            entries: leaf,
          };
        }
        bounds.left = Math.min(bounds.left, rect.left, rect.right);
        bounds.right = Math.max(bounds.right, rect.left, rect.right);
        bounds.top = Math.min(bounds.top, rect.top, rect.bottom);
        bounds.bottom = Math.max(bounds.bottom, rect.top, rect.bottom);
      }
    }
    return { bounds, entries: leaf };
  }
  const middle = (start + end) >>> 1;
  const left = buildIndexRange(entries, start, middle);
  const right = buildIndexRange(entries, middle, end);
  return {
    bounds: {
      left: Math.min(left.bounds.left, right.bounds.left),
      right: Math.max(left.bounds.right, right.bounds.right),
      top: Math.min(left.bounds.top, right.bounds.top),
      bottom: Math.max(left.bounds.bottom, right.bounds.bottom),
    },
    children: [left, right],
  };
}

/**
 * 선분 bbox와 겹치는 가지만 탐색하고 기존과 동일한 교차 판정식을 사용한다.
 * @param index 스냅샷 공유 인덱스
 * @param start 선분 시작점
 * @param end 선분 끝점
 * @param expanded 중간 선분의 padding 적용 여부
 * @param sourceNodeId 제외할 시작 노드
 * @param targetNodeId 제외할 끝 노드
 * @returns 하나 이상의 장애물과 교차하는지 여부
 */
export function indexedSegmentIntersectsObstacles(
  index: EdgeObstacleIndex,
  start: EdgePoint,
  end: EdgePoint,
  expanded: boolean,
  sourceNodeId?: string,
  targetNodeId?: string,
): boolean {
  const { bounds } = index;
  if (
    Math.max(start.x, end.x) < bounds.left ||
    Math.min(start.x, end.x) > bounds.right ||
    Math.max(start.y, end.y) < bounds.top ||
    Math.min(start.y, end.y) > bounds.bottom
  )
    return false;

  if (index.children) {
    return index.children.some((child) =>
      indexedSegmentIntersectsObstacles(child, start, end, expanded, sourceNodeId, targetNodeId),
    );
  }
  for (const entry of index.entries ?? []) {
    if (
      entry.nodeId !== undefined &&
      (entry.nodeId === sourceNodeId || entry.nodeId === targetNodeId)
    )
      continue;
    const rect = expanded ? entry.expanded : entry.raw;
    if (segmentIntersectsObstacle(start, end, rect)) return true;
  }
  return false;
}

/**
 * 기존 열린 구간 판정을 유지한다. 경계 접촉과 길이 0의 처리도 유지한다.
 * @param start 선분 시작점
 * @param end 선분 끝점
 * @param obstacle 검사할 장애물
 * @returns 선분이 장애물 내부를 통과하는지 여부
 */
export function segmentIntersectsObstacle(
  start: EdgePoint,
  end: EdgePoint,
  obstacle: EdgeObstacleRect,
): boolean {
  if (start.x === end.x) {
    const x = start.x;
    if (x <= obstacle.left || x >= obstacle.right) return false;
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return maxY > obstacle.top && minY < obstacle.bottom;
  }
  const y = start.y;
  if (y <= obstacle.top || y >= obstacle.bottom) return false;
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  return maxX > obstacle.left && minX < obstacle.right;
}
