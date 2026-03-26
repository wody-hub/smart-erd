import type { Node } from '@xyflow/react';
import type { TableNodeData, ERDEdge, TableNode } from '../types/erd.js';
import type { DslPreviewGraph, DslPreviewNode } from './dsl-preview-graph.js';
import { matchPreviewNodesToPersistedNodes } from './preview-position-sync.js';

/** persisted 캔버스에서 draft overlay 노드에 부여할 고유 ID prefix */
const PREVIEW_DRAFT_OVERLAY_NODE_ID_PREFIX = 'draft-overlay:';

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
 * preview 노드를 persisted overlay 전용 고유 노드 ID로 변환한다.
 *
 * persisted 노드와 draft overlay 노드가 같은 React Flow id를 공유하면
 * 노드 상태가 섞여 협업 렌더가 불안정해질 수 있으므로, overlay는 항상 별도 id를 사용한다.
 *
 * @param previewNodeId 원본 preview 노드 ID
 * @returns overlay 전용 노드 ID
 */
function buildPreviewDraftOverlayNodeId(previewNodeId: string): string {
  return `${PREVIEW_DRAFT_OVERLAY_NODE_ID_PREFIX}${previewNodeId}`;
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
  const previewNodeIdToOverlayNodeId = new Map<string, string>();

  const draftOnlyEdges = previewGraph.edges.filter((edge) => !persistedEdgeIds.has(edge.id));
  const referencedNodeIds = new Set<string>();
  for (const edge of draftOnlyEdges) {
    referencedNodeIds.add(edge.source);
    referencedNodeIds.add(edge.target);
  }

  const overlayNodes = previewGraph.nodes.flatMap((node) => {
    const matchedPersistedNode = matchedNodes.get(node.id);
    if (matchedPersistedNode) {
      const shouldRenderVisibleOverlay = !isPreviewNodeEquivalentToPersistedNode(
        node,
        matchedPersistedNode,
      );
      if (!shouldRenderVisibleOverlay && !referencedNodeIds.has(node.id)) {
        return [];
      }
      const overlayNodeId = buildPreviewDraftOverlayNodeId(node.id);
      previewNodeIdToOverlayNodeId.set(node.id, overlayNodeId);
      return [
        {
          ...node,
          id: overlayNodeId,
          type: shouldRenderVisibleOverlay ? 'previewTable' : 'previewGhostTable',
          draggable: false,
          selectable: false,
          connectable: false,
          focusable: false,
          position: matchedPersistedNode.position,
        } satisfies Node<TableNodeData>,
      ];
    }

    const overlayNodeId = buildPreviewDraftOverlayNodeId(node.id);
    previewNodeIdToOverlayNodeId.set(node.id, overlayNodeId);
    return [
      {
        ...node,
        id: overlayNodeId,
        type: 'previewTable',
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
      } satisfies DslPreviewNode,
    ];
  });

  const overlayEdges: ERDEdge[] = [];
  for (const edge of draftOnlyEdges) {
    const source = previewNodeIdToOverlayNodeId.get(edge.source);
    const target = previewNodeIdToOverlayNodeId.get(edge.target);
    if (!source || !target) {
      continue;
    }
    overlayEdges.push({
      ...edge,
      source,
      target,
      selectable: false,
      focusable: false,
    });
  }

  if (overlayNodes.length === 0 && overlayEdges.length === 0) {
    return null;
  }

  return {
    nodes: overlayNodes,
    edges: overlayEdges,
  };
}
