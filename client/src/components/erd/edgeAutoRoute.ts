import type { BuildStraightEdgePointsInput, EdgePoint } from './edgeWaypointGeometry.js';

export interface EdgeObstacleRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface ObstacleNode {
  /** 노드 식별자 */
  id: string;
  /** 테이블 계열 노드 유형 */
  type?: string;
  /** 캔버스 위치 */
  position: { x: number; y: number };
  /** 지정 너비 */
  width?: number;
  /** 지정 높이 */
  height?: number;
  /** 측정된 크기 */
  measured?: { width?: number; height?: number };
  /** 컬럼 데이터 */
  data?: { columns?: unknown[] };
}

interface ObstacleSnapshot {
  /** 노드 ID별 라우팅 장애물 좌표 */
  rectByNodeId: Map<string, EdgeObstacleRect>;
  /** 엣지별 안정된 장애물 배열 */
  rectsByEdge: Map<string, EdgeObstacleRect[]>;
}

const obstacleSnapshots = new WeakMap<readonly ObstacleNode[], ObstacleSnapshot>();
const obstacleSnapshotsByGeometry = new Map<string, ObstacleSnapshot>();
const MAX_GEOMETRY_SNAPSHOTS = 8;
const DEFAULT_NODE_WIDTH = 420;
const DEFAULT_NODE_BASE_HEIGHT = 52;
const DEFAULT_NODE_ROW_HEIGHT = 30;

/**
 * React Flow 노드 스냅샷에서 특정 엣지의 장애물 좌표를 캐시한다.
 * 같은 노드 배열과 endpoint 조합을 사용하면 동일한 배열 참조를 반환한다.
 * @param nodes React Flow 노드 스냅샷
 * @param sourceNodeId 엣지 시작 노드 ID
 * @param targetNodeId 엣지 끝 노드 ID
 * @returns endpoint를 제외한 테이블 장애물 좌표
 */
export function getCachedEdgeObstacleRects(
  nodes: readonly ObstacleNode[],
  sourceNodeId: string,
  targetNodeId: string,
): EdgeObstacleRect[] {
  let snapshot = obstacleSnapshots.get(nodes);
  if (!snapshot) {
    const geometrySignature = buildObstacleGeometrySignature(nodes);
    snapshot = obstacleSnapshotsByGeometry.get(geometrySignature);
    if (!snapshot) {
      const rectByNodeId = new Map<string, EdgeObstacleRect>();
      for (const node of nodes) {
        if (node.type !== 'table' && node.type !== 'previewTable') continue;
        const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
        const height =
          node.measured?.height ??
          node.height ??
          DEFAULT_NODE_BASE_HEIGHT + (node.data?.columns?.length ?? 0) * DEFAULT_NODE_ROW_HEIGHT;
        rectByNodeId.set(node.id, {
          left: node.position.x,
          right: node.position.x + width,
          top: node.position.y,
          bottom: node.position.y + height,
        });
      }
      snapshot = { rectByNodeId, rectsByEdge: new Map() };
      obstacleSnapshotsByGeometry.set(geometrySignature, snapshot);
      if (obstacleSnapshotsByGeometry.size > MAX_GEOMETRY_SNAPSHOTS) {
        const oldestSignature = obstacleSnapshotsByGeometry.keys().next().value;
        if (oldestSignature) obstacleSnapshotsByGeometry.delete(oldestSignature);
      }
    }
    obstacleSnapshots.set(nodes, snapshot);
  }

  const edgeKey = `${sourceNodeId}\u0000${targetNodeId}`;
  const cached = snapshot.rectsByEdge.get(edgeKey);
  if (cached) return cached;

  const rects: EdgeObstacleRect[] = [];
  for (const [nodeId, rect] of snapshot.rectByNodeId) {
    if (nodeId !== sourceNodeId && nodeId !== targetNodeId) rects.push(rect);
  }
  snapshot.rectsByEdge.set(edgeKey, rects);
  return rects;
}

/**
 * 테이블 장애물 좌표와 크기만으로 안정된 스냅샷 키를 만든다.
 * 컬럼 이름 등 렌더링 데이터 변경은 장애물 경로 캐시를 무효화하지 않는다.
 * @param nodes React Flow 노드 스냅샷
 * @returns 장애물 기하 정보의 직렬화 키
 */
function buildObstacleGeometrySignature(nodes: readonly ObstacleNode[]): string {
  return JSON.stringify(
    nodes
      .filter((node) => node.type === 'table' || node.type === 'previewTable')
      .map((node) => [
        node.id,
        node.position.x,
        node.position.y,
        node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
        node.measured?.height ??
          node.height ??
          DEFAULT_NODE_BASE_HEIGHT + (node.data?.columns?.length ?? 0) * DEFAULT_NODE_ROW_HEIGHT,
      ]),
  );
}

const OBSTACLE_PADDING = 20;
const OUTER_CORRIDOR_MARGIN = 48;

/** 장애물 사각형 배열이 순서와 네 좌표까지 같은지 비교한다. */
export function areEdgeObstacleRectsEqual(
  left: readonly EdgeObstacleRect[],
  right: readonly EdgeObstacleRect[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((obstacle, index) => {
    const other = right[index];
    return (
      obstacle.left === other.left &&
      obstacle.right === other.right &&
      obstacle.top === other.top &&
      obstacle.bottom === other.bottom
    );
  });
}

export function buildObstacleAvoidingAutoRoute(
  input: BuildStraightEdgePointsInput,
  obstacles: EdgeObstacleRect[],
): EdgePoint[] | null {
  if (obstacles.length === 0) {
    return null;
  }

  const expandedObstacles = obstacles.map((obstacle) => expandObstacle(obstacle, OBSTACLE_PADDING));
  const sourcePoint = {
    x: input.sourceX + input.sourceDirection * input.sourceMarkerOffset,
    y: input.sourceY,
  };
  const targetPoint = {
    x: input.targetX + input.targetDirection * input.targetMarkerOffset,
    y: input.targetY,
  };
  const defaultPoints = compactOrthogonalPoints([
    sourcePoint,
    { x: (sourcePoint.x + targetPoint.x) / 2, y: sourcePoint.y },
    { x: (sourcePoint.x + targetPoint.x) / 2, y: targetPoint.y },
    targetPoint,
  ]);

  if (!routeIntersectsObstacles(defaultPoints, obstacles, expandedObstacles)) {
    return null;
  }

  const xCandidates = new Set<number>([
    Math.min(sourcePoint.x, targetPoint.x) - OUTER_CORRIDOR_MARGIN,
    Math.max(sourcePoint.x, targetPoint.x) + OUTER_CORRIDOR_MARGIN,
  ]);
  const yCandidates = new Set<number>([
    Math.min(sourcePoint.y, targetPoint.y) - OUTER_CORRIDOR_MARGIN,
    Math.max(sourcePoint.y, targetPoint.y) + OUTER_CORRIDOR_MARGIN,
  ]);

  for (const obstacle of expandedObstacles) {
    xCandidates.add(obstacle.left - OUTER_CORRIDOR_MARGIN);
    xCandidates.add(obstacle.right + OUTER_CORRIDOR_MARGIN);
    yCandidates.add(obstacle.top - OUTER_CORRIDOR_MARGIN);
    yCandidates.add(obstacle.bottom + OUTER_CORRIDOR_MARGIN);
  }

  let bestRoute: EdgePoint[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const corridorX of xCandidates) {
    const candidate = compactOrthogonalPoints([
      sourcePoint,
      { x: corridorX, y: sourcePoint.y },
      { x: corridorX, y: targetPoint.y },
      targetPoint,
    ]);
    if (routeIntersectsObstacles(candidate, obstacles, expandedObstacles)) {
      continue;
    }
    const score = calculateRouteScore(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestRoute = candidate;
    }
  }

  for (const corridorY of yCandidates) {
    const candidate = compactOrthogonalPoints([
      sourcePoint,
      { x: sourcePoint.x, y: corridorY },
      { x: targetPoint.x, y: corridorY },
      targetPoint,
    ]);
    if (routeIntersectsObstacles(candidate, obstacles, expandedObstacles)) {
      continue;
    }
    const score = calculateRouteScore(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestRoute = candidate;
    }
  }

  return bestRoute;
}

function expandObstacle(obstacle: EdgeObstacleRect, padding: number): EdgeObstacleRect {
  return {
    left: obstacle.left - padding,
    right: obstacle.right + padding,
    top: obstacle.top - padding,
    bottom: obstacle.bottom + padding,
  };
}

function compactOrthogonalPoints(points: EdgePoint[]): EdgePoint[] {
  if (points.length <= 2) {
    return points;
  }

  const compacted: EdgePoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = compacted[compacted.length - 1];
    const current = points[index];
    const next = points[index + 1];
    const sharesVertical = previous.x === current.x && current.x === next.x;
    const sharesHorizontal = previous.y === current.y && current.y === next.y;

    if (sharesVertical || sharesHorizontal) {
      continue;
    }

    compacted.push(current);
  }

  compacted.push(points[points.length - 1]);
  return compacted;
}

function routeIntersectsObstacles(
  points: EdgePoint[],
  rawObstacles: EdgeObstacleRect[],
  expandedObstacles: EdgeObstacleRect[],
): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const obstacles = index === 0 || index === points.length - 2 ? rawObstacles : expandedObstacles;
    for (const obstacle of obstacles) {
      if (segmentIntersectsObstacle(start, end, obstacle)) {
        return true;
      }
    }
  }
  return false;
}

function segmentIntersectsObstacle(
  start: EdgePoint,
  end: EdgePoint,
  obstacle: EdgeObstacleRect,
): boolean {
  if (start.x === end.x) {
    const x = start.x;
    if (x <= obstacle.left || x >= obstacle.right) {
      return false;
    }
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return maxY > obstacle.top && minY < obstacle.bottom;
  }

  const y = start.y;
  if (y <= obstacle.top || y >= obstacle.bottom) {
    return false;
  }
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  return maxX > obstacle.left && minX < obstacle.right;
}

function calculateRouteScore(points: EdgePoint[]): number {
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    totalLength +=
      Math.abs(points[index + 1].x - points[index].x) +
      Math.abs(points[index + 1].y - points[index].y);
  }
  return totalLength + (points.length - 2) * 12;
}
