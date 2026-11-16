import type { EdgeProps } from '@xyflow/react';
import { extractColId } from '@/lib/handle-id';
import type { RelationType, TableNodeData } from '@/types/erd';

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
