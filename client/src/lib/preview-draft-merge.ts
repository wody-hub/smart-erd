import type { Node } from '@xyflow/react';
import type { TableNodeData, ERDEdge, TableNode } from '../types/erd.js';
import type { DslPreviewGraph, DslPreviewNode } from './dsl-preview-graph.js';
import { matchPreviewNodesToPersistedNodes } from './preview-position-sync.js';

/** sync/erd 모드에서 표시할 shared draft overlay 그래프 */
export interface PreviewDraftOverlayGraph {
  /** overlay 노드 목록 */
  nodes: Node<TableNodeData>[];
  /** overlay 엣지 목록 */
  edges: ERDEdge[];
}

/**
 * shared preview draft graph를 persisted 캔버스용 overlay 그래프로 변환한다.
 *
 * persisted와 중복되는 테이블/관계는 제외하고, draft 전용 객체와
 * draft 전용 관계에 필요한 ghost 앵커 노드만 남긴다.
 *
 * @param previewGraph shared preview draft graph
 * @param persistedNodes persisted 테이블 노드 목록
 * @param persistedEdges persisted 엣지 목록
 * @returns persisted 캔버스용 overlay 그래프 또는 null
 */
export function buildPreviewDraftOverlayGraph(
  previewGraph: DslPreviewGraph | null,
  persistedNodes: readonly TableNode[],
  persistedEdges: readonly ERDEdge[],
): PreviewDraftOverlayGraph | null {
  if (!previewGraph || previewGraph.nodes.length === 0) {
    return null;
  }

  const matchedNodes = matchPreviewNodesToPersistedNodes(previewGraph.nodes, persistedNodes);
  const persistedEdgeIds = new Set(persistedEdges.map((edge) => edge.id));
  const overlayEdges = previewGraph.edges
    .filter((edge) => !persistedEdgeIds.has(edge.id))
    .map((edge) => ({
      ...edge,
      selectable: false,
      focusable: false,
    }));

  const referencedNodeIds = new Set<string>();
  for (const edge of overlayEdges) {
    referencedNodeIds.add(edge.source);
    referencedNodeIds.add(edge.target);
  }

  const overlayNodes = previewGraph.nodes.flatMap((node) => {
    const matchedPersistedNode = matchedNodes.get(node.id);
    if (matchedPersistedNode) {
      if (!referencedNodeIds.has(node.id)) {
        return [];
      }
      return [
        {
          ...node,
          type: 'previewGhostTable',
          draggable: false,
          selectable: false,
          connectable: false,
          focusable: false,
          position: matchedPersistedNode.position,
        } satisfies Node<TableNodeData>,
      ];
    }

    return [
      {
        ...node,
        type: 'previewTable',
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
      } satisfies DslPreviewNode,
    ];
  });

  if (overlayNodes.length === 0 && overlayEdges.length === 0) {
    return null;
  }

  return {
    nodes: overlayNodes,
    edges: overlayEdges,
  };
}
