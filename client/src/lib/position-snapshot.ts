import type { Node } from '@xyflow/react';
import type { TableNode, TableNodeData } from '@/types/erd';

/**
 * 테이블 노드의 위치 복원용 고유 키를 결정한다.
 *
 * 1순위: tableTermId (용어사전 연동 ID — 가장 안정적)
 * 2순위: logicalTableName (논리명)
 * 3순위: label (물리명, 정규화)
 *
 * @param data 테이블 노드 데이터
 * @returns 위치 복원 매칭용 키
 */
export function resolveTableKey(data: TableNodeData): string {
  if (data.tableTermId != null) {
    return `term:${data.tableTermId}`;
  }
  if (data.logicalTableName) {
    return `logical:${data.logicalTableName}`;
  }
  return `label:${data.label.trim().toLowerCase()}`;
}

/**
 * 현재 테이블 노드들의 위치를 스냅샷으로 캡처한다.
 *
 * 동일 키가 복수 노드에서 발생하면 첫 번째만 유지하고 이후 충돌은 건너뛴다.
 *
 * @param nodes 현재 테이블 노드 배열
 * @returns tableKey → {x, y} 매핑
 */
export function snapshotPositions(nodes: TableNode[]): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const key = resolveTableKey(node.data);
    if (map.has(key)) {
      console.warn('[position-snapshot] duplicate key, skipping:', key, node.id);
      continue;
    }
    map.set(key, { x: node.position.x, y: node.position.y });
  }
  return map;
}

/**
 * 스냅샷 위치를 기반으로 매칭되는 테이블 노드의 위치를 복원한다.
 *
 * @param nodes 복원 대상 노드 배열
 * @param snapshot tableKey → {x, y} 스냅샷
 * @returns 위치가 복원된 노드 배열 (복원된 노드가 없으면 null)
 */
export function restorePositions(
  nodes: Node<TableNodeData>[],
  snapshot: Map<string, { x: number; y: number }>,
): Node<TableNodeData>[] | null {
  let restored = false;
  const result = nodes.map((node) => {
    const key = resolveTableKey(node.data);
    const pos = snapshot.get(key);
    if (pos && (node.position.x !== pos.x || node.position.y !== pos.y)) {
      restored = true;
      return { ...node, position: { x: pos.x, y: pos.y } };
    }
    return node;
  });
  return restored ? result : null;
}
