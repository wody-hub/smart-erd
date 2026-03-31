import type { BuildStraightEdgePointsInput, EdgePoint } from './edgeWaypointGeometry.js';

export interface EdgeObstacleRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const OBSTACLE_PADDING = 20;
const OUTER_CORRIDOR_MARGIN = 48;

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
