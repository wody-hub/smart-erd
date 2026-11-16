import {
  buildEdgeObstacleIndex,
  indexedSegmentIntersectsObstacles,
  segmentIntersectsObstacle,
  type EdgeObstacleIndex,
  type IndexedEdgeObstacle,
} from './edgeObstacleIndex.js';
import type { BuildStraightEdgePointsInput, EdgePoint } from './edgeWaypointGeometry.js';

/** 라우팅 장애물의 캔버스 좌표. */
export interface EdgeObstacleRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 장애물 스냅샷에 필요한 React Flow 노드 기하 정보. */
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

/** 노드 기하만으로 공유하는 장애물 스냅샷. */
interface ObstacleSnapshot {
  /** 모든 endpoint 조합에서 공유하는 공간 인덱스 */
  index: EdgeObstacleIndex;
  /** 다른 스냅샷과의 변경 노드 계산을 한 번만 수행한다. */
  changes: WeakMap<ObstacleSnapshot, IndexedEdgeObstacle[]>;
  /** 노드 ID별 라우팅 장애물 좌표 */
  rectByNodeId: Map<string, EdgeObstacleRect>;
  /** 엣지별 안정된 장애물 배열 */
  rectsByEdge: Map<string, EdgeObstacleRect[]>;
}

/** 기존 배열 API에 연결하는 내부 스냅샷/endpoint 메타데이터. */
interface EdgeObstacleMetadata {
  snapshot: ObstacleSnapshot;
  sourceNodeId: string;
  targetNodeId: string;
}

/** 기본 경로가 비어 있음이 증명된 입력만 저장한다. 우회 실패 null은 저장하지 않는다. */
interface ClearRouteCacheEntry {
  snapshot: ObstacleSnapshot;
}

const edgeObstacleMetadata = new WeakMap<readonly EdgeObstacleRect[], EdgeObstacleMetadata>();
const clearRoutes = new Map<string, ClearRouteCacheEntry>();
const MAX_CLEAR_ROUTES = 1024;

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
      snapshot = {
        rectByNodeId,
        rectsByEdge: new Map(),
        index: buildEdgeObstacleIndex(
          [...rectByNodeId].map(([nodeId, raw]) => ({
            nodeId,
            raw,
            expanded: expandObstacle(raw, OBSTACLE_PADDING),
          })),
        ),
        changes: new WeakMap(),
      };
      obstacleSnapshotsByGeometry.set(geometrySignature, snapshot);
      if (obstacleSnapshotsByGeometry.size > MAX_GEOMETRY_SNAPSHOTS) {
        const oldestSignature = obstacleSnapshotsByGeometry.keys().next().value;
        if (oldestSignature) {
          const evicted = obstacleSnapshotsByGeometry.get(oldestSignature);
          obstacleSnapshotsByGeometry.delete(oldestSignature);
          for (const [key, entry] of clearRoutes) {
            if (entry.snapshot === evicted) clearRoutes.delete(key);
          }
        }
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
  edgeObstacleMetadata.set(rects, { snapshot, sourceNodeId, targetNodeId });
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

/**
 * 장애물 사각형 배열이 순서와 네 좌표까지 같은지 비교한다.
 * @param left 이전 장애물
 * @param right 현재 장애물
 * @returns 순서와 좌표가 모두 같은지 여부
 */
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

/**
 * 기존 후보 순서와 점 배열을 유지하며 장애물 우회 경로를 계산한다.
 * @param input 앵커 좌표, 방향과 마커 오프셋 (기존과 동일하게 waypoints는 사용하지 않는다)
 * @param obstacles endpoint를 제외한 장애물 배열
 * @returns 우회 점 배열, 또는 기본 경로가 비었거나 우회 후보가 없으면 null
 */
export function buildObstacleAvoidingAutoRoute(
  input: BuildStraightEdgePointsInput,
  obstacles: EdgeObstacleRect[],
): EdgePoint[] | null {
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

  const metadata = edgeObstacleMetadata.get(obstacles);
  const cacheKey = metadata ? buildClearRouteKey(input, metadata) : null;
  const previous = cacheKey === null ? undefined : clearRoutes.get(cacheKey);
  if (
    metadata &&
    cacheKey !== null &&
    previous &&
    canReuseClearRoute(previous.snapshot, metadata, defaultPoints)
  ) {
    rememberClearRoute(cacheKey, metadata.snapshot);
    return null;
  }

  // 일반 가변 배열은 참조만으로 캐시하지 않는다. 스냅샷 배열만 인덱스를 공유한다.
  const index =
    metadata?.snapshot.index ??
    buildEdgeObstacleIndex(
      obstacles.map((raw) => ({ raw, expanded: expandObstacle(raw, OBSTACLE_PADDING) })),
    );
  if (!routeIntersectsObstacles(defaultPoints, index, metadata)) {
    if (metadata && cacheKey !== null) rememberClearRoute(cacheKey, metadata.snapshot);
    return null;
  }
  // 기본 경로가 다시 막혔다면 이전의 clear 증명을 폐기한다.
  if (cacheKey !== null) clearRoutes.delete(cacheKey);
  const expandedObstacles = obstacles.map((obstacle) => expandObstacle(obstacle, OBSTACLE_PADDING));

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
    if (routeIntersectsObstacles(candidate, index, metadata)) {
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
    if (routeIntersectsObstacles(candidate, index, metadata)) {
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

/**
 * 장애물의 모든 변을 padding만큼 확장한다.
 * @param obstacle 원본 장애물
 * @param padding 여유 거리
 * @returns 확장된 사각형
 */
function expandObstacle(obstacle: EdgeObstacleRect, padding: number): EdgeObstacleRect {
  return {
    left: obstacle.left - padding,
    right: obstacle.right + padding,
    top: obstacle.top - padding,
    bottom: obstacle.bottom + padding,
  };
}

/**
 * 동일 직선 위의 중간 점을 기존 순서대로 제거한다.
 * @param points 직교 경로
 * @returns 기존과 동일한 축약 점 배열
 */
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

/**
 * 선분별 endpoint 제외와 원본/확장 전환을 유지하며 공간 인덱스를 조회한다.
 * @param points 직교 경로
 * @param index 공유 장애물 인덱스
 * @param metadata 제외할 endpoint ID
 * @returns 장애물 교차 여부
 */
function routeIntersectsObstacles(
  points: EdgePoint[],
  index: EdgeObstacleIndex,
  metadata?: EdgeObstacleMetadata,
): boolean {
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    if (
      indexedSegmentIntersectsObstacles(
        index,
        points[segment],
        points[segment + 1],
        segment !== 0 && segment !== points.length - 2,
        metadata?.sourceNodeId,
        metadata?.targetNodeId,
      )
    )
      return true;
  }
  return false;
}

/**
 * 입력과 endpoint 조합으로 clear 증명을 조회한다. -0과 비유한 값도 구분한다.
 * @param input 경로 입력
 * @param metadata endpoint ID
 * @returns 충돌 없는 입력 키
 */
function buildClearRouteKey(
  input: BuildStraightEdgePointsInput,
  metadata: EdgeObstacleMetadata,
): string {
  return JSON.stringify([
    metadata.sourceNodeId,
    metadata.targetNodeId,
    ...[
      input.sourceX,
      input.sourceY,
      input.targetX,
      input.targetY,
      input.sourceDirection,
      input.targetDirection,
      input.sourceMarkerOffset,
      input.targetMarkerOffset,
    ].map((value) => (Object.is(value, -0) ? '-0' : String(value))),
  ]);
}

/**
 * clear 증명을 LRU로 제한하여 과거 스냅샷의 무제한 보유를 방지한다.
 * @param key 경로 입력 키
 * @param snapshot 증명이 성립하는 스냅샷
 * @returns 없음
 */
function rememberClearRoute(key: string, snapshot: ObstacleSnapshot): void {
  clearRoutes.delete(key);
  clearRoutes.set(key, { snapshot });
  if (clearRoutes.size > MAX_CLEAR_ROUTES) clearRoutes.delete(clearRoutes.keys().next().value!);
}

/**
 * 스냅샷 사이의 변경 노드를 한 번만 비교해 이전/현재 좌표를 모두 저장한다.
 * 순서 변경은 clear 증명에 영향을 주지 않는다. 우회 후보는 재사용하지 않는다.
 * @param previous 이전 증명 스냅샷
 * @param next 현재 스냅샷
 * @returns 변경/추가/삭제된 장애물의 이전/현재 좌표
 */
function getChangedObstacles(
  previous: ObstacleSnapshot,
  next: ObstacleSnapshot,
): IndexedEdgeObstacle[] {
  const cached = next.changes.get(previous);
  if (cached) return cached;
  const changed: IndexedEdgeObstacle[] = [];
  for (const [nodeId, raw] of previous.rectByNodeId) {
    const current = next.rectByNodeId.get(nodeId);
    if (!current || !areEdgeObstacleRectsEqual([raw], [current])) {
      changed.push({ nodeId, raw, expanded: expandObstacle(raw, OBSTACLE_PADDING) });
      if (current)
        changed.push({ nodeId, raw: current, expanded: expandObstacle(current, OBSTACLE_PADDING) });
    }
  }
  for (const [nodeId, raw] of next.rectByNodeId) {
    if (!previous.rectByNodeId.has(nodeId))
      changed.push({ nodeId, raw, expanded: expandObstacle(raw, OBSTACLE_PADDING) });
  }
  next.changes.set(previous, changed);
  return changed;
}

/**
 * 동일 입력에서 변경 노드의 이전/현재 사각형이 기본 경로와 교차하지 않으면 clear 증명이 유지된다.
 * endpoint 변경은 장애물에서 제외하고 앵커 변경은 입력 키가 달라지므로 다시 판정한다.
 * @param previous 증명된 스냅샷
 * @param metadata 현재 스냅샷과 endpoint
 * @param points 동일 입력의 기본 경로
 * @returns 기본 경로가 계속 비어 있음을 증명할 수 있는지 여부
 */
function canReuseClearRoute(
  previous: ObstacleSnapshot,
  metadata: EdgeObstacleMetadata,
  points: EdgePoint[],
): boolean {
  if (previous === metadata.snapshot) return true;
  const changed = getChangedObstacles(previous, metadata.snapshot);
  for (const entry of changed) {
    if (entry.nodeId === metadata.sourceNodeId || entry.nodeId === metadata.targetNodeId) continue;
    for (let segment = 0; segment < points.length - 1; segment += 1) {
      const rect = segment === 0 || segment === points.length - 2 ? entry.raw : entry.expanded;
      if (segmentIntersectsObstacle(points[segment], points[segment + 1], rect)) return false;
    }
  }
  return true;
}

/**
 * 맨해튼 길이와 꺾임 수로 후보의 우선순위를 계산한다.
 * @param points 직교 경로
 * @returns 기존 후보 평가 점수
 */
function calculateRouteScore(points: EdgePoint[]): number {
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    totalLength +=
      Math.abs(points[index + 1].x - points[index].x) +
      Math.abs(points[index + 1].y - points[index].y);
  }
  return totalLength + (points.length - 2) * 12;
}
