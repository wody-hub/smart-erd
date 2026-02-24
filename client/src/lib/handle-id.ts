/**
 * Handle ID에서 컬럼 ID를 추출한다.
 *
 * Handle ID 형식: `{nodeId}-{colId}-source` 또는 `{nodeId}-{colId}-target`
 *
 * @param handleId 핸들 ID
 * @param nodeId   노드 ID
 * @returns 컬럼 ID
 */
export function extractColId(handleId: string, nodeId: string): string {
  return handleId.replace(`${nodeId}-`, '').replace(/-(?:source|target)$/, '');
}
