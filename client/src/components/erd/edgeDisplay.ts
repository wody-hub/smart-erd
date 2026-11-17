import type { Edge } from '@xyflow/react';

/** 엣지 하이라이트 상태를 반영하면서 표시 값이 달라진 엣지만 복사한다.
 *
 * @param edges 표시할 원본 엣지 목록
 * @param highlightedEdgeId 현재 하이라이트된 엣지 ID
 * @param isDraggingNode 노드 드래그 진행 여부
 * @returns 필요한 엣지만 새 객체로 바꾼 엣지 목록
 */
export function applyEdgeDisplayState(
  edges: Edge[],
  highlightedEdgeId: string | null,
  isDraggingNode: boolean,
): Edge[] {
  return edges.map((edge) => {
    const selected = edge.id === highlightedEdgeId;
    const animated = !isDraggingNode && selected;
    if ((edge.selected ?? false) === selected && (edge.animated ?? false) === animated) {
      return edge;
    }
    return { ...edge, selected, animated };
  });
}
