import type { Waypoint } from '../../types/erd.js';

export interface EdgePoint {
  x: number;
  y: number;
}

export interface OrthogonalRouteSegment {
  segmentIndex: number;
  start: EdgePoint;
  end: EdgePoint;
  center: EdgePoint;
  orientation: 'horizontal' | 'vertical';
}

const DEFAULT_SEGMENT_SPLIT_OFFSET = 32;
const MIN_SEGMENT_SPLIT_HALF_SPAN = 12;
const MAX_SEGMENT_SPLIT_HALF_SPAN = 24;

export interface WaypointMidpoint extends Waypoint {
  insertIndex: number;
}

interface OrthogonalSegment {
  start: EdgePoint;
  end: EdgePoint;
  insertIndex: number;
}

export interface BuildStraightEdgePointsInput {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourceDirection: number;
  targetDirection: number;
  sourceMarkerOffset: number;
  targetMarkerOffset: number;
  waypoints: Waypoint[];
}

export function buildStraightEdgePoints(input: BuildStraightEdgePointsInput): EdgePoint[] {
  return buildOrthogonalRoute(input).points;
}

export function buildOrthogonalRoute(input: BuildStraightEdgePointsInput): {
  points: EdgePoint[];
  segments: OrthogonalSegment[];
} {
  const waypoints = input.waypoints ?? [];
  const sourcePoint: EdgePoint = {
    x: input.sourceX + input.sourceDirection * input.sourceMarkerOffset,
    y: input.sourceY,
  };
  const targetPoint: EdgePoint = {
    x: input.targetX + input.targetDirection * input.targetMarkerOffset,
    y: input.targetY,
  };

  if (waypoints.length === 0) {
    const midX = (sourcePoint.x + targetPoint.x) / 2;
    const points = compactOrthogonalPoints([
      sourcePoint,
      { x: midX, y: sourcePoint.y },
      { x: midX, y: targetPoint.y },
      targetPoint,
    ]);
    return {
      points,
      segments: pointsToSegments(points, 0),
    };
  }

  const anchors: EdgePoint[] = [sourcePoint, ...waypoints, targetPoint];
  const points: EdgePoint[] = [sourcePoint];
  const segments: OrthogonalSegment[] = [];

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const current = anchors[index];
    const isLastAnchor = index === anchors.length - 1;
    const insertIndex = index - 1;

    if (isLastAnchor) {
      appendPoint(points, segments, { x: previous.x, y: current.y }, insertIndex);
      appendPoint(points, segments, current, insertIndex);
      continue;
    }

    appendPoint(points, segments, { x: current.x, y: previous.y }, insertIndex);
    appendPoint(points, segments, current, insertIndex);
  }

  return compactRoute(points, segments);
}

function appendPoint(
  points: EdgePoint[],
  segments: OrthogonalSegment[],
  point: EdgePoint,
  insertIndex: number,
) {
  const last = points[points.length - 1];
  if (!last || last.x !== point.x || last.y !== point.y) {
    if (last) {
      segments.push({
        start: last,
        end: point,
        insertIndex,
      });
    }
    points.push(point);
  }
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

function compactRoute(
  points: EdgePoint[],
  segments: OrthogonalSegment[],
): { points: EdgePoint[]; segments: OrthogonalSegment[] } {
  const compactedPoints = compactOrthogonalPoints(points);
  const compactedSegments: OrthogonalSegment[] = [];

  for (let index = 0; index < compactedPoints.length - 1; index += 1) {
    const start = compactedPoints[index];
    const end = compactedPoints[index + 1];
    const matched = segments.find(
      (segment) =>
        segment.start.x === start.x &&
        segment.start.y === start.y &&
        segment.end.x === end.x &&
        segment.end.y === end.y,
    );
    compactedSegments.push({
      start,
      end,
      insertIndex: matched?.insertIndex ?? 0,
    });
  }

  return { points: compactedPoints, segments: compactedSegments };
}

export function buildOrthogonalRouteSegments(
  input: BuildStraightEdgePointsInput,
): OrthogonalRouteSegment[] {
  const { points } = buildOrthogonalRoute(input);
  return pointsToOrthogonalSegments(points);
}

function pointsToSegments(points: EdgePoint[], insertIndex: number): OrthogonalSegment[] {
  const segments: OrthogonalSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({
      start: points[index],
      end: points[index + 1],
      insertIndex,
    });
  }
  return segments;
}

function pointsToOrthogonalSegments(points: EdgePoint[]): OrthogonalRouteSegment[] {
  const segments: OrthogonalRouteSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    segments.push({
      segmentIndex: index,
      start,
      end,
      center: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      },
      orientation: start.x === end.x ? 'vertical' : 'horizontal',
    });
  }
  return segments;
}

export function routePointsToWaypoints(points: EdgePoint[]): Waypoint[] {
  if (points.length <= 2) {
    return [];
  }
  return points.slice(1, -1).map((point) => ({ x: point.x, y: point.y }));
}

export function shiftOrthogonalSegment(
  routePoints: EdgePoint[],
  segmentIndex: number,
  nextValue: number,
): EdgePoint[] {
  if (segmentIndex < 0 || segmentIndex >= routePoints.length - 1) {
    return routePoints.map((point) => ({ ...point }));
  }

  const points = routePoints.map((point) => ({ ...point }));
  const lastIndex = points.length - 1;
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  const isVertical = start.x === end.x;

  if (segmentIndex === 0) {
    if (isVertical) {
      return compactOrthogonalPoints([
        points[0],
        { x: nextValue, y: points[0].y },
        { x: nextValue, y: points[1].y },
        ...points.slice(2),
      ]);
    }
    return compactOrthogonalPoints([
      points[0],
      { x: points[0].x, y: nextValue },
      { x: points[1].x, y: nextValue },
      ...points.slice(2),
    ]);
  }

  if (segmentIndex === lastIndex - 1) {
    if (isVertical) {
      return compactOrthogonalPoints([
        ...points.slice(0, segmentIndex),
        { x: nextValue, y: points[segmentIndex].y },
        { x: nextValue, y: points[lastIndex].y },
        points[lastIndex],
      ]);
    }
    return compactOrthogonalPoints([
      ...points.slice(0, segmentIndex),
      { x: points[segmentIndex].x, y: nextValue },
      { x: points[lastIndex].x, y: nextValue },
      points[lastIndex],
    ]);
  }

  if (isVertical) {
    points[segmentIndex].x = nextValue;
    points[segmentIndex + 1].x = nextValue;
  } else {
    points[segmentIndex].y = nextValue;
    points[segmentIndex + 1].y = nextValue;
  }

  return compactOrthogonalPoints(points);
}

export function splitOrthogonalSegment(
  routePoints: EdgePoint[],
  segmentIndex: number,
  clickPoint: EdgePoint,
): EdgePoint[] {
  if (segmentIndex < 0 || segmentIndex >= routePoints.length - 1) {
    return routePoints.map((point) => ({ ...point }));
  }

  const start = routePoints[segmentIndex];
  const end = routePoints[segmentIndex + 1];
  const isVertical = start.x === end.x;
  const segmentLength = isVertical ? Math.abs(end.y - start.y) : Math.abs(end.x - start.x);

  if (segmentLength < MIN_SEGMENT_SPLIT_HALF_SPAN * 2) {
    return routePoints.map((point) => ({ ...point }));
  }

  const halfSpan = Math.min(
    MAX_SEGMENT_SPLIT_HALF_SPAN,
    Math.max(MIN_SEGMENT_SPLIT_HALF_SPAN, segmentLength / 4),
  );

  if (isVertical) {
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const centerY = clamp(clickPoint.y, minY + halfSpan, maxY - halfSpan);
    const directionY = Math.sign(end.y - start.y) || 1;
    const splitStartY = centerY - directionY * halfSpan;
    const splitEndY = centerY + directionY * halfSpan;
    const offsetX =
      start.x +
      resolveSplitOffsetSign(routePoints, segmentIndex, 'vertical') * DEFAULT_SEGMENT_SPLIT_OFFSET;

    return compactOrthogonalPoints([
      ...routePoints.slice(0, segmentIndex + 1),
      { x: start.x, y: splitStartY },
      { x: offsetX, y: splitStartY },
      { x: offsetX, y: splitEndY },
      { x: start.x, y: splitEndY },
      ...routePoints.slice(segmentIndex + 1),
    ]);
  }

  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const centerX = clamp(clickPoint.x, minX + halfSpan, maxX - halfSpan);
  const directionX = Math.sign(end.x - start.x) || 1;
  const splitStartX = centerX - directionX * halfSpan;
  const splitEndX = centerX + directionX * halfSpan;
  const offsetY =
    start.y +
    resolveSplitOffsetSign(routePoints, segmentIndex, 'horizontal') * DEFAULT_SEGMENT_SPLIT_OFFSET;

  return compactOrthogonalPoints([
    ...routePoints.slice(0, segmentIndex + 1),
    { x: splitStartX, y: start.y },
    { x: splitStartX, y: offsetY },
    { x: splitEndX, y: offsetY },
    { x: splitEndX, y: start.y },
    ...routePoints.slice(segmentIndex + 1),
  ]);
}

export function toggleOrthogonalSegmentDetail(
  routePoints: EdgePoint[],
  segmentIndex: number,
  clickPoint: EdgePoint,
): EdgePoint[] {
  const collapsed = collapseOrthogonalDetour(routePoints, segmentIndex);
  if (collapsed) {
    return collapsed;
  }
  return splitOrthogonalSegment(routePoints, segmentIndex, clickPoint);
}

function collapseOrthogonalDetour(
  routePoints: EdgePoint[],
  segmentIndex: number,
): EdgePoint[] | null {
  if (segmentIndex < 1 || segmentIndex + 2 >= routePoints.length) {
    return null;
  }

  const previous = routePoints[segmentIndex - 1];
  const start = routePoints[segmentIndex];
  const end = routePoints[segmentIndex + 1];
  const next = routePoints[segmentIndex + 2];

  const centerIsVertical = start.x === end.x;
  const beforeIsVertical = previous.x === start.x;
  const afterIsVertical = end.x === next.x;

  if (beforeIsVertical !== afterIsVertical || beforeIsVertical === centerIsVertical) {
    return null;
  }

  if (centerIsVertical) {
    if (previous.x !== next.x || previous.y !== start.y || next.y !== end.y) {
      return null;
    }
  } else if (previous.y !== next.y || previous.x !== start.x || next.x !== end.x) {
    return null;
  }

  return compactOrthogonalPoints([
    ...routePoints.slice(0, segmentIndex),
    ...routePoints.slice(segmentIndex + 2),
  ]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveSplitOffsetSign(
  routePoints: EdgePoint[],
  segmentIndex: number,
  orientation: 'horizontal' | 'vertical',
): number {
  const previous = segmentIndex > 0 ? routePoints[segmentIndex - 1] : null;
  const start = routePoints[segmentIndex];
  const end = routePoints[segmentIndex + 1];
  const next = segmentIndex + 2 < routePoints.length ? routePoints[segmentIndex + 2] : null;

  if (orientation === 'horizontal') {
    const previousSign = previous ? Math.sign(start.y - previous.y) : 0;
    const nextSign = next ? Math.sign(next.y - end.y) : 0;
    const overallSign = Math.sign(routePoints[routePoints.length - 1].y - routePoints[0].y);
    return previousSign || nextSign || overallSign || 1;
  }

  const previousSign = previous ? Math.sign(start.x - previous.x) : 0;
  const nextSign = next ? Math.sign(next.x - end.x) : 0;
  const overallSign = Math.sign(routePoints[routePoints.length - 1].x - routePoints[0].x);
  return previousSign || nextSign || overallSign || 1;
}

export function buildPolylineSvgPath(points: EdgePoint[]): string {
  if (points.length === 0) {
    return '';
  }
  const [first, ...rest] = points;
  return `M ${first.x},${first.y} ${rest.map((point) => `L ${point.x},${point.y}`).join(' ')}`;
}

export function buildRoundedOrthogonalSvgPath(points: EdgePoint[], radius = 12): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0].x},${points[0].y}`;
  }
  if (points.length === 2) {
    return buildPolylineSvgPath(points);
  }

  let path = `M ${points[0].x},${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incomingDx = current.x - previous.x;
    const incomingDy = current.y - previous.y;
    const outgoingDx = next.x - current.x;
    const outgoingDy = next.y - current.y;
    const incomingLength = Math.abs(incomingDx) + Math.abs(incomingDy);
    const outgoingLength = Math.abs(outgoingDx) + Math.abs(outgoingDy);

    const isCorner =
      incomingLength > 0 &&
      outgoingLength > 0 &&
      (incomingDx === 0 || incomingDy === 0) &&
      (outgoingDx === 0 || outgoingDy === 0) &&
      !(
        Math.sign(incomingDx) === Math.sign(outgoingDx) &&
        Math.sign(incomingDy) === Math.sign(outgoingDy)
      );

    if (!isCorner) {
      path += ` L ${current.x},${current.y}`;
      continue;
    }

    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
    const cornerStart = {
      x: current.x - Math.sign(incomingDx) * cornerRadius,
      y: current.y - Math.sign(incomingDy) * cornerRadius,
    };
    const cornerEnd = {
      x: current.x + Math.sign(outgoingDx) * cornerRadius,
      y: current.y + Math.sign(outgoingDy) * cornerRadius,
    };

    path += ` L ${cornerStart.x},${cornerStart.y}`;
    path += ` Q ${current.x},${current.y} ${cornerEnd.x},${cornerEnd.y}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x},${last.y}`;
  return path;
}

export function buildWaypointMidpoints(input: BuildStraightEdgePointsInput): WaypointMidpoint[] {
  const { segments } = buildOrthogonalRoute(input);
  const midpoints: WaypointMidpoint[] = [];
  for (const segment of segments) {
    midpoints.push({
      x: (segment.start.x + segment.end.x) / 2,
      y: (segment.start.y + segment.end.y) / 2,
      insertIndex: segment.insertIndex,
    });
  }
  return midpoints;
}
