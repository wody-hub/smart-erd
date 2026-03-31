import type { ERDEdge, TableNode } from '../types/erd.js';
import type { DslPreviewNode } from './dsl-preview-graph.js';

type DiagramDefinitionExportNode = TableNode | DslPreviewNode;

/**
 * 정의서 export API 요청용 다이어그램 JSON을 직렬화한다.
 *
 * @param nodes 현재 내보낼 노드 목록
 * @param edges 현재 내보낼 엣지 목록
 * @returns 정의서 export API에 전달할 JSON 문자열
 */
export function serializeDiagramDefinitionExportContent(
  nodes: readonly DiagramDefinitionExportNode[],
  edges: readonly ERDEdge[],
): string {
  return JSON.stringify({
    nodes,
    edges,
    groups: [],
  });
}
