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
 * preview 컬럼과 persisted 컬럼의 시각적으로 의미 있는 필드를 비교용 문자열로 직렬화한다.
 *
 * @param column 비교할 컬럼
 * @returns 안정적인 비교용 직렬화 문자열
 */
function serializeComparableColumn(column: TableNodeData['columns'][number]): string {
  return JSON.stringify([
    column.name,
    column.type,
    column.pk ?? false,
    column.fk ?? false,
    column.autoIncrement ?? false,
    column.nullable ?? false,
    column.logicalName ?? '',
    column.termId ?? null,
    column.domainId ?? null,
  ]);
}

/**
 * preview 노드 데이터가 persisted 테이블 데이터와 동일한지 판정한다.
 *
 * 위치와 노드 ID는 제외하고, 화면에 드러나는 테이블/컬럼 메타만 비교한다.
 *
 * @param previewNode preview 노드
 * @param persistedNode persisted 테이블 노드
 * @returns 동일하면 true
 */
function isPreviewNodeEquivalentToPersistedNode(
  previewNode: DslPreviewNode,
  persistedNode: TableNode,
): boolean {
  if (
    previewNode.data.label !== persistedNode.data.label ||
    (previewNode.data.logicalTableName ?? '') !== (persistedNode.data.logicalTableName ?? '') ||
    (previewNode.data.tableTermId ?? null) !== (persistedNode.data.tableTermId ?? null) ||
    (previewNode.data.headerColor ?? '') !== (persistedNode.data.headerColor ?? '') ||
    (previewNode.data.handleLayout ?? 'split') !== (persistedNode.data.handleLayout ?? 'split')
  ) {
    return false;
  }

  if (previewNode.data.columns.length !== persistedNode.data.columns.length) {
    return false;
  }

  return previewNode.data.columns.every(
    (column, index) =>
      serializeComparableColumn(column) ===
      serializeComparableColumn(persistedNode.data.columns[index]),
  );
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
      const shouldRenderVisibleOverlay = !isPreviewNodeEquivalentToPersistedNode(node, matchedPersistedNode);
      if (!shouldRenderVisibleOverlay && !referencedNodeIds.has(node.id)) {
        return [];
      }
      return [
        {
          ...node,
          type: shouldRenderVisibleOverlay ? 'previewTable' : 'previewGhostTable',
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
