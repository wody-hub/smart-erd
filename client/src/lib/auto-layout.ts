import dagre from 'dagre';
import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';
import type { TableNodeData } from '@/types/erd';

/** 테이블 노드의 고정 너비 (px) */
const NODE_WIDTH = 280;
/** 실제 렌더링되는 테이블 노드 너비 (px) */
const RENDERED_NODE_WIDTH = 420;
/** 테이블 노드 헤더 높이 (px) */
const HEADER_HEIGHT = 40;
/** 컬럼 행 높이 (px) — 2행 레이아웃 (논리명 + 물리명/타입) */
const ROW_HEIGHT = 52;
/** Add Column 버튼 영역 높이 (px) */
const FOOTER_HEIGHT = 32;
const ELK_NODE_NODE_SPACING = 80;
const ELK_LAYER_SPACING = 120;
const ELK_COMPONENT_SPACING = 160;
const ELK_LAYOUT_MARGIN = 40;
const DEFAULT_LARGE_GRAPH_THRESHOLD = 150;

export type ErdLayoutDirection = 'RIGHT' | 'DOWN';
export type ErdLayoutStatus = 'applied' | 'failed';

export interface ErdLayoutResult {
  nodes: Node<TableNodeData>[];
  status: ErdLayoutStatus;
}

export interface ErdLayoutOptions {
  candidateDirections?: ErdLayoutDirection[];
  largeGraphThreshold?: number;
  elkLayout?: (graph: ElkNode) => Promise<ElkNode>;
}

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
 * 렌더링된 ERD 테이블 노드의 크기를 반환한다.
 *
 * @param node 테이블 노드
 * @returns 노드의 렌더링 기준 크기
 */
export function measureErdNode(node: Node<TableNodeData>): { width: number; height: number } {
  return {
    width: RENDERED_NODE_WIDTH,
    height: calculateNodeHeight(node.data.columns.length),
  };
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

function buildElkGraph(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
  direction: ErdLayoutDirection,
): ElkNode {
  const nodeIds = new Set(nodes.map((node) => node.id));

  return {
    id: 'erd-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.nodeNode': String(ELK_NODE_NODE_SPACING),
      'elk.spacing.componentComponent': String(ELK_COMPONENT_SPACING),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(ELK_LAYER_SPACING),
      'elk.padding': `[top=${ELK_LAYOUT_MARGIN},left=${ELK_LAYOUT_MARGIN},bottom=${ELK_LAYOUT_MARGIN},right=${ELK_LAYOUT_MARGIN}]`,
    },
    children: nodes.map((node) => {
      const size = measureErdNode(node);
      return { id: node.id, width: size.width, height: size.height };
    }),
    edges: edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map(
        (edge): ElkExtendedEdge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        }),
      ),
  };
}

function applyElkCoordinates(
  sourceNodes: Node<TableNodeData>[],
  layoutGraph: ElkNode,
): Node<TableNodeData>[] {
  const childrenById = new Map((layoutGraph.children ?? []).map((child) => [child.id, child]));

  return sourceNodes.map((node) => {
    const child = childrenById.get(node.id);
    if (typeof child?.x !== 'number' || typeof child.y !== 'number') {
      return node;
    }

    return { ...node, position: { x: child.x, y: child.y } };
  });
}

function getLayoutBounds(nodes: Node<TableNodeData>[]): { width: number; height: number } {
  if (nodes.length === 0) {
    return { width: 0, height: 0 };
  }

  const boxes = nodes.map((node) => {
    const size = measureErdNode(node);
    return {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + size.width,
      bottom: node.position.y + size.height,
    };
  });

  return {
    width: Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left)),
    height: Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top)),
  };
}

function getAspectScore(nodes: Node<TableNodeData>[]): number {
  const bounds = getLayoutBounds(nodes);
  if (bounds.width === 0 || bounds.height === 0) {
    return 1;
  }

  return Math.max(bounds.width / bounds.height, bounds.height / bounds.width);
}

function getCandidateDirections(
  nodes: Node<TableNodeData>[],
  options: ErdLayoutOptions,
): ErdLayoutDirection[] {
  if (options.candidateDirections && options.candidateDirections.length > 0) {
    return options.candidateDirections;
  }

  const threshold = options.largeGraphThreshold ?? DEFAULT_LARGE_GRAPH_THRESHOLD;
  if (nodes.length >= threshold) {
    return ['RIGHT'];
  }

  return ['RIGHT', 'DOWN'];
}

/**
 * ELK 레이아웃 알고리즘으로 ERD 테이블을 렌더링 크기 기준으로 자동 배치한다.
 *
 * @param nodes 현재 테이블 노드 배열
 * @param edges 현재 엣지 배열
 * @param options 레이아웃 후보 및 테스트용 어댑터 옵션
 * @returns 배치 결과와 적용 상태
 */
export async function applyErdLayout(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
  options: ErdLayoutOptions = {},
): Promise<ErdLayoutResult> {
  if (nodes.length === 0) {
    return { nodes, status: 'applied' };
  }

  const elk = new ELK();
  const layout = options.elkLayout ?? ((graph: ElkNode) => elk.layout(graph));
  const directions = getCandidateDirections(nodes, options);

  try {
    const candidates = await Promise.all(
      directions.map(async (direction) => {
        const layoutGraph = await layout(buildElkGraph(nodes, edges, direction));
        const layoutNodes = applyElkCoordinates(nodes, layoutGraph);
        return { nodes: layoutNodes, score: getAspectScore(layoutNodes) };
      }),
    );

    const best = candidates.reduce((currentBest, candidate) =>
      candidate.score < currentBest.score ? candidate : currentBest,
    );

    return { nodes: best.nodes, status: 'applied' };
  } catch {
    return { nodes, status: 'failed' };
  }
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
