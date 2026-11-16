import type { EdgeProps } from '@xyflow/react';
import { extractColId } from '@/lib/handle-id';
import type { EdgeRoutingType, RelationType, TableNodeData } from '@/types/erd';
import {
  buildObstacleAvoidingAutoRoute,
  getCachedEdgeObstacleRects,
  type EdgeObstacleRect,
} from './edgeAutoRoute.js';
import type { BuildStraightEdgePointsInput, EdgePoint } from './edgeWaypointGeometry.js';

/** 엣지별 selector를 재생성하는 고정 길이 라우팅 입력 튜플이다. */
export interface EdgeAutoRouteInput extends Omit<BuildStraightEdgePointsInput, 'waypoints'> {
  sourceNodeId: string;
  targetNodeId: string;
  routingType: EdgeRoutingType;
  detourOff: boolean;
}

/** 라우팅 selector가 구독하는 React Flow 상태의 최소 구조다. */
export interface EdgeAutoRouteSelectorState {
  nodes: Parameters<typeof getCachedEdgeObstacleRects>[0];
}

/**
 * 순서가 같은 경로 점의 좌표를 비교한다. 동일 참조는 좌표를 읽지 않는다.
 * @param previous 이전 경로 또는 기본 경로를 뜻하는 null
 * @param next 다음 경로 또는 기본 경로를 뜻하는 null
 * @returns 두 경로의 점 개수와 좌표가 같으면 true
 */
export function areEdgeRoutePointsEqual(
  previous: readonly EdgePoint[] | null,
  next: readonly EdgePoint[] | null,
): boolean {
  if (previous === next) return true;
  if (!previous || !next || previous.length !== next.length) return false;
  return previous.every((point, index) => point.x === next[index].x && point.y === next[index].y);
}

/**
 * 장애물 대신 최종 경로를 구독하고 좌표가 같은 결과의 이전 참조를 유지한다.
 * 같은 nodes는 O(1), 새 nodes의 동일 기하는 공유 스냅샷으로 라우팅을 생략한다.
 * 기하 변경 시 기존 clear 증명/공간 인덱스를 사용하고 우회 후보는 다시 계산한다.
 * @param input selector 수명 동안 고정되는 앵커, 방향, 마커, endpoint와 라우팅 옵션
 * @param buildRoute 실제 우회 계산 함수. 호출 계측을 추가할 때도 같은 알고리즘을 사용한다.
 * @returns 경로 좌표가 달라질 때만 새 결과 참조를 반환하는 selector
 */
export function createEdgeAutoRouteSelector(
  input: EdgeAutoRouteInput,
  buildRoute: typeof buildObstacleAvoidingAutoRoute = buildObstacleAvoidingAutoRoute,
): (state: EdgeAutoRouteSelectorState) => EdgePoint[] | null {
  let previousNodes: EdgeAutoRouteSelectorState['nodes'] | undefined;
  let previousObstacles: EdgeObstacleRect[] | undefined;
  let previousResult: EdgePoint[] | null = null;
  const routeInput: BuildStraightEdgePointsInput = { ...input, waypoints: [] };

  return (state) => {
    if (input.routingType !== 'smoothstep' || input.detourOff) return null;
    if (previousNodes === state.nodes) return previousResult;

    const obstacles = getCachedEdgeObstacleRects(
      state.nodes,
      input.sourceNodeId,
      input.targetNodeId,
    );
    previousNodes = state.nodes;
    if (previousObstacles === obstacles) return previousResult;

    const result = buildRoute(routeInput, obstacles);
    previousObstacles = obstacles;
    if (!areEdgeRoutePointsEqual(previousResult, result)) previousResult = result;
    return previousResult;
  };
}

/** 관계 엣지의 카디널리티 렌더링에 필요한 값만 담는다. */
export interface EdgeCardinality {
  sourceSymbol: 'one';
  targetSymbol: 'one' | 'many';
  optional: boolean;
}

/** React Flow 상태에서 대상 노드 데이터를 읽는 데 필요한 최소 구조다. */
export interface EdgeCardinalitySelectorState {
  nodeLookup: ReadonlyMap<string, { data?: unknown }>;
}

/**
 * 대상 노드의 카디널리티 관련 필드만 선택하고 결과 참조를 재사용하는 selector를 만든다.
 * @param targetNodeId 대상 노드 ID
 * @param targetHandle 대상 핸들 ID
 * @param relationType 관계 유형
 * @returns 카디널리티 입력이 같을 때 동일 결과 참조를 반환하는 selector
 */
export function createEdgeCardinalitySelector(
  targetNodeId: string,
  targetHandle: string | null | undefined,
  relationType: RelationType,
): (state: EdgeCardinalitySelectorState) => EdgeCardinality {
  let previous: EdgeCardinality | null = null;

  return (state) => {
    const childData = state.nodeLookup.get(targetNodeId)?.data as TableNodeData | undefined;
    let optional = true;
    let targetSymbol: EdgeCardinality['targetSymbol'] = 'many';

    if (childData) {
      if (targetHandle) {
        const colId = extractColId(targetHandle, targetNodeId);
        const fkColumn = childData.columns.find((column) => column.id === colId);
        optional = fkColumn?.nullable !== false;
      }

      if (relationType === 'identifying') {
        const primaryKeyCount = childData.columns.filter((column) => column.pk).length;
        const foreignPrimaryKeyCount = childData.columns.filter(
          (column) => column.pk && column.fk,
        ).length;
        targetSymbol =
          foreignPrimaryKeyCount > 0 && foreignPrimaryKeyCount === primaryKeyCount ? 'one' : 'many';
      }
    }

    if (previous?.targetSymbol === targetSymbol && previous.optional === optional) {
      return previous;
    }

    previous = { sourceSymbol: 'one', targetSymbol, optional };
    return previous;
  };
}

/**
 * 재생성된 React Flow props의 시각적 입력이 같으면 렌더링을 건너뛴다.
 * @param previous 이전 props
 * @param next 다음 props
 * @returns 렌더링에 영향을 주는 모든 props가 같으면 true
 */
export function areErdRelationEdgePropsEqual(previous: EdgeProps, next: EdgeProps): boolean {
  const previousKeys = Object.keys(previous) as Array<keyof EdgeProps>;
  const nextKeys = Object.keys(next) as Array<keyof EdgeProps>;
  if (previousKeys.length !== nextKeys.length) return false;

  return previousKeys.every((key) => {
    if (!(key in next)) return false;
    const previousValue = previous[key];
    const nextValue = next[key];
    if (key === 'data' || key === 'style') {
      return areShallowRecordsEqual(
        previousValue as Record<string, unknown> | undefined,
        nextValue as Record<string, unknown> | undefined,
      );
    }
    return Object.is(previousValue, nextValue);
  });
}

/**
 * 비교 가능한 객체의 직접 필드만 비교한다.
 * @param previous 이전 객체
 * @param next 다음 객체
 * @returns 두 객체의 직접 필드가 같으면 true
 */
function areShallowRecordsEqual(
  previous: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
): boolean {
  if (Object.is(previous, next)) return true;
  if (!previous || !next) return false;
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  return previousKeys.every((key) => Object.is(previous[key], next[key]));
}
