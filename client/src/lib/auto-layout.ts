import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { TableNodeData } from '@/types/erd';

/** 테이블 노드의 고정 너비 (px) */
const NODE_WIDTH = 280;
/** 테이블 노드 헤더 높이 (px) */
const HEADER_HEIGHT = 40;
/** 컬럼 행 높이 (px) — 2행 레이아웃 (논리명 + 물리명/타입) */
const ROW_HEIGHT = 52;
/** Add Column 버튼 영역 높이 (px) */
const FOOTER_HEIGHT = 32;

/**
 * 테이블 노드의 높이를 컬럼 수에 기반하여 계산한다.
 *
 * @param columnCount 컬럼 수
 * @returns 노드 높이 (px)
 */
function calculateNodeHeight(columnCount: number): number {
  return HEADER_HEIGHT + columnCount * ROW_HEIGHT + FOOTER_HEIGHT;
}

/**
 * dagre 레이아웃 알고리즘을 사용하여 노드 위치를 좌→우 방향으로 자동 배치한다.
 *
 * @param nodes 현재 테이블 노드 배열
 * @param edges 현재 엣지 배열
 * @returns 위치가 재계산된 새 노드 배열
 */
export function applyDagreLayout(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
): Node<TableNodeData>[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 80,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    const height = calculateNodeHeight(node.data.columns.length);
    g.setNode(node.id, { width: NODE_WIDTH, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const height = calculateNodeHeight(node.data.columns.length);
    return {
      ...node,
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - height / 2,
      },
    };
  });
}

/**
 * full 배치 대신 기존 테이블명(label) 기준 위치를 가능한 범위에서 복원한다.
 *
 * replaceFromDdl 이후 신규 노드는 기본 그리드 위치를 유지하고,
 * 이름이 동일한 노드는 기존 위치를 재사용해 화면 흔들림을 줄인다.
 *
 * @param previousNodes 교체 이전 노드
 * @param nextNodes 교체 직후 노드
 * @returns 위치가 보정된 노드 배열
 */
export function applyIncrementalLayoutByLabel(
  previousNodes: Node<TableNodeData>[],
  nextNodes: Node<TableNodeData>[],
): Node<TableNodeData>[] {
  if (previousNodes.length === 0 || nextNodes.length === 0) {
    return nextNodes;
  }

  const positionsByLabel = new Map<string, Array<{ x: number; y: number }>>();
  for (const node of previousNodes) {
    const label = String(node.data.label ?? '');
    if (!positionsByLabel.has(label)) {
      positionsByLabel.set(label, []);
    }
    positionsByLabel.get(label)?.push({ x: node.position.x, y: node.position.y });
  }

  const usedByLabel = new Map<string, number>();
  return nextNodes.map((node) => {
    const label = String(node.data.label ?? '');
    const positions = positionsByLabel.get(label);
    if (!positions || positions.length === 0) {
      return node;
    }
    const usedCount = usedByLabel.get(label) ?? 0;
    if (usedCount >= positions.length) {
      return node;
    }
    usedByLabel.set(label, usedCount + 1);
    const position = positions[usedCount];
    return {
      ...node,
      position,
    };
  });
}
