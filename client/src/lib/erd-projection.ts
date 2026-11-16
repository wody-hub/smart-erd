import type { Node } from '@xyflow/react';
import type { TableNodeData } from '@/types/erd';

/** React Flow가 canvas store에 기록하는 로컬 상호작용 상태. */
const LOCAL_NODE_STATE_FIELDS = ['selected', 'dragging', 'resizing'] as const;
/** 구조가 동일할 때만 재사용할 수 있는 로컬 크기 정보. */
const LOCAL_NODE_DIMENSION_FIELDS = [
  'measured',
  'width',
  'height',
  'initialWidth',
  'initialHeight',
] as const;

/**
 * 컬럼 행/핸들 배치가 달라져 기존 크기와 핸들 경계를 무효화해야 하는지 확인한다.
 * 이름/타입 등 텍스트 변경은 ResizeObserver가 실제 크기 변경을 감지한다.
 * @param current 기존 테이블 데이터
 * @param next 새 테이블 데이터
 * @returns 컬럼 ID 순서/개수 또는 유효 핸들 레이아웃 변경 여부
 */
function hasNodeStructureChanged(current: TableNodeData, next: TableNodeData): boolean {
  return (
    (current.handleLayout ?? 'split') !== (next.handleLayout ?? 'split') ||
    current.columns.length !== next.columns.length ||
    current.columns.some((column, index) => column.id !== next.columns[index]?.id)
  );
}

/**
 * 같은 문서/노드 생명주기의 projection에 명시적인 React Flow 로컬 필드만 병합한다.
 * 문서 필드(id/type/data/position)는 새 projection을 따르며 구조 변경은 크기를 폐기한다.
 * @param current 현재 노드 목록
 * @param requestedIds 이번 projection 대상 ID
 * @param nextEntries 새로 projection된 노드
 * @param resetNodeIds 문서 교체/전체 재투영/Y.Map 교체로 재사용을 금지할 ID
 * @returns 대상 외 노드 참조와 허용된 로컬 상태를 유지한 노드 목록
 */
export function mergeProjectedNodesById(
  current: Node<TableNodeData>[],
  requestedIds: Set<string>,
  nextEntries: Node<TableNodeData>[],
  resetNodeIds: ReadonlySet<string> = new Set(),
): Node<TableNodeData>[] {
  if (requestedIds.size === 0) return current;
  const currentById = new Map(current.map((node) => [node.id, node]));
  const nextNodes = nextEntries.map((node) => {
    const previous = currentById.get(node.id);
    if (!previous || previous.type !== node.type || resetNodeIds.has(node.id)) return node;

    const fields = hasNodeStructureChanged(previous.data, node.data)
      ? LOCAL_NODE_STATE_FIELDS
      : [...LOCAL_NODE_STATE_FIELDS, ...LOCAL_NODE_DIMENSION_FIELDS];
    const localFields = Object.fromEntries(
      fields
        .filter((field) => Object.prototype.hasOwnProperty.call(previous, field))
        .map((field) => [field, previous[field]]),
    );
    // 이동 중 projection은 store에서 지연한다. 원격/레이아웃 위치 적용 시 과거 drag는 끝낸다.
    if (
      previous.dragging !== undefined &&
      (previous.position.x !== node.position.x || previous.position.y !== node.position.y)
    ) {
      localFields.dragging = false;
    }
    return { ...node, ...localFields };
  });
  return mergeProjectedEntitiesById(current, requestedIds, nextNodes);
}

/**
 * ID 기준 projection 갱신을 기존 배열 순서와 엔티티 참조를 보존하며 병합한다.
 * @param current 현재 엔티티 목록
 * @param requestedIds 이번 projection에서 교체할 엔티티 ID
 * @param nextEntries 새로 projection된 엔티티
 * @returns 유지된 참조와 새 엔티티를 포함하는 목록
 */
export function mergeProjectedEntitiesById<T extends { id: string }>(
  current: T[],
  requestedIds: Set<string>,
  nextEntries: T[],
): T[] {
  if (requestedIds.size === 0) return current;

  const nextById = new Map(nextEntries.map((entry) => [entry.id, entry]));
  const merged = current
    .filter((entry) => !requestedIds.has(entry.id) || nextById.has(entry.id))
    .map((entry) => nextById.get(entry.id) ?? entry);
  const currentIds = new Set(current.map((entry) => entry.id));

  for (const entry of nextEntries) {
    if (!currentIds.has(entry.id)) merged.push(entry);
  }

  return merged;
}
