import type { Edge, Node } from '@xyflow/react';
import type { Column, TableNodeData } from '@/types/erd';

const MIN_RENDERED_NODE_WIDTH = 820;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 52;
const FOOTER_HEIGHT = 32;
const CHARACTER_WIDTH = 8;
const HEADER_EXTRA_WIDTH = 520;
const NODE_ROW_SPACING = 90;
const NODE_COLUMN_SPACING = 140;
const COMPONENT_SPACING = 180;
const COLLISION_SPACING = 80;
const LAYOUT_MARGIN = 40;
const DEFAULT_TARGET_ASPECT = 1.5;
const SMALL_COMPONENT_INLINE_LIMIT = 5;

export type ErdLayoutDirection = 'RIGHT' | 'DOWN';
export type ErdLayoutStatus = 'applied' | 'failed';

export interface ErdLayoutResult {
  nodes: Node<TableNodeData>[];
  status: ErdLayoutStatus;
}

export interface ErdLayoutOptions {
  candidateDirections?: ErdLayoutDirection[];
  largeGraphThreshold?: number;
  targetAspect?: number;
}

interface MeasuredSize {
  width: number;
  height: number;
}

interface GraphIndex {
  outgoing: Map<string, Set<string>>;
  incoming: Map<string, Set<string>>;
  undirected: Map<string, Set<string>>;
}

interface RelativeLayout {
  nodes: Node<TableNodeData>[];
  width: number;
  height: number;
}

/** 테이블 노드 실제 렌더 높이를 계산한다. */
function calculateNodeHeight(columnCount: number): number {
  return HEADER_HEIGHT + Math.max(columnCount, 1) * ROW_HEIGHT + FOOTER_HEIGHT;
}

function estimateCharacterWidth(value: string | undefined | null, minimumCharacters = 0): number {
  return Math.max(value?.length ?? 0, minimumCharacters) * CHARACTER_WIDTH;
}

function measureColumnWidth(column: Column): number {
  const logicalWidth = estimateCharacterWidth(column.logicalName, 10 + 2);
  const physicalWidth = estimateCharacterWidth(column.name, Math.max(column.name.length + 2, 10));
  const fixedBadgesWidth = column.pk ? 80 : 60;
  const fixedTypeWidth = 96;
  const fixedDomainWidth = 112;
  const rowPaddingAndGaps = 96;

  return logicalWidth + physicalWidth + fixedBadgesWidth + fixedTypeWidth + fixedDomainWidth + rowPaddingAndGaps;
}

/**
 * ERD 테이블 노드 크기를 렌더링 구조에 맞춰 보수적으로 추정한다.
 *
 * 실제 노드는 w-max/min-w 기반이고 컬럼 논리명/물리명이 ch 단위 최소폭을 만든다.
 * 자동정렬은 DOM 측정 전에 실행되므로, 여기서 폭을 작게 잡으면 정렬 후 시각적으로 겹친다.
 */
export function measureErdNode(node: Node<TableNodeData>): MeasuredSize {
  const columns = node.data.columns ?? [];
  const headerWidth =
    estimateCharacterWidth(node.data.logicalTableName, 10) +
    estimateCharacterWidth(String(node.data.label ?? ''), 10) +
    HEADER_EXTRA_WIDTH;
  const widestColumnWidth = columns.reduce(
    (widest, column) => Math.max(widest, measureColumnWidth(column)),
    0,
  );

  return {
    width: Math.max(MIN_RENDERED_NODE_WIDTH, headerWidth, widestColumnWidth),
    height: calculateNodeHeight(columns.length),
  };
}

function getLayoutBounds(nodes: Node<TableNodeData>[]): MeasuredSize {
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

function buildGraphIndex(nodes: Node<TableNodeData>[], edges: Edge[]): GraphIndex {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  const undirected = new Map<string, Set<string>>();

  nodes.forEach((node) => {
    outgoing.set(node.id, new Set());
    incoming.set(node.id, new Set());
    undirected.set(node.id, new Set());
  });

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) {
      return;
    }

    outgoing.get(edge.source)?.add(edge.target);
    incoming.get(edge.target)?.add(edge.source);
    undirected.get(edge.source)?.add(edge.target);
    undirected.get(edge.target)?.add(edge.source);
  });

  return { outgoing, incoming, undirected };
}

function getWeakComponents(nodes: Node<TableNodeData>[], graph: GraphIndex): Node<TableNodeData>[][] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const components: Node<TableNodeData>[][] = [];

  nodes.forEach((startNode) => {
    if (visited.has(startNode.id)) {
      return;
    }

    const queue = [startNode.id];
    const componentIds: string[] = [];
    visited.add(startNode.id);

    for (let index = 0; index < queue.length; index += 1) {
      const nodeId = queue[index];
      componentIds.push(nodeId);
      graph.undirected.get(nodeId)?.forEach((nextId) => {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
        }
      });
    }

    const componentIdSet = new Set(componentIds);
    components.push(nodes.filter((node) => componentIdSet.has(node.id) && nodesById.has(node.id)));
  });

  return components;
}

function orderComponentNodes(
  componentNodes: Node<TableNodeData>[],
  graph: GraphIndex,
  originalIndexById: Map<string, number>,
): Node<TableNodeData>[] {
  const componentIds = new Set(componentNodes.map((node) => node.id));
  const indegree = new Map<string, number>();
  const level = new Map<string, number>();

  componentNodes.forEach((node) => {
    const incomingCount = Array.from(graph.incoming.get(node.id) ?? []).filter((id) => componentIds.has(id)).length;
    indegree.set(node.id, incomingCount);
    level.set(node.id, 0);
  });

  const ready = componentNodes
    .filter((node) => indegree.get(node.id) === 0)
    .sort((left, right) => (originalIndexById.get(left.id) ?? 0) - (originalIndexById.get(right.id) ?? 0));
  const orderedIds: string[] = [];

  while (ready.length > 0) {
    const node = ready.shift();
    if (!node) {
      break;
    }

    orderedIds.push(node.id);
    Array.from(graph.outgoing.get(node.id) ?? [])
      .filter((targetId) => componentIds.has(targetId))
      .sort((left, right) => (originalIndexById.get(left) ?? 0) - (originalIndexById.get(right) ?? 0))
      .forEach((targetId) => {
        level.set(targetId, Math.max(level.get(targetId) ?? 0, (level.get(node.id) ?? 0) + 1));
        indegree.set(targetId, (indegree.get(targetId) ?? 0) - 1);
        if (indegree.get(targetId) === 0) {
          const targetNode = componentNodes.find((candidate) => candidate.id === targetId);
          if (targetNode) {
            ready.push(targetNode);
            ready.sort(
              (left, right) => (originalIndexById.get(left.id) ?? 0) - (originalIndexById.get(right.id) ?? 0),
            );
          }
        }
      });
  }

  componentNodes.forEach((node) => {
    if (!orderedIds.includes(node.id)) {
      const predecessorLevel = Array.from(graph.incoming.get(node.id) ?? [])
        .filter((id) => componentIds.has(id))
        .reduce((maxLevel, id) => Math.max(maxLevel, level.get(id) ?? 0), 0);
      level.set(node.id, predecessorLevel + 1);
      orderedIds.push(node.id);
    }
  });

  const nodesById = new Map(componentNodes.map((node) => [node.id, node]));
  return orderedIds
    .map((id) => nodesById.get(id))
    .filter((node): node is Node<TableNodeData> => !!node)
    .sort((left, right) => {
      const levelDelta = (level.get(left.id) ?? 0) - (level.get(right.id) ?? 0);
      return levelDelta || (orderedIds.indexOf(left.id) - orderedIds.indexOf(right.id));
    });
}

function getAverageMeasuredSize(nodes: Node<TableNodeData>[]): MeasuredSize {
  if (nodes.length === 0) {
    return { width: MIN_RENDERED_NODE_WIDTH, height: calculateNodeHeight(1) };
  }

  const totals = nodes.reduce(
    (acc, node) => {
      const size = measureErdNode(node);
      return { width: acc.width + size.width, height: acc.height + size.height };
    },
    { width: 0, height: 0 },
  );

  return {
    width: totals.width / nodes.length,
    height: totals.height / nodes.length,
  };
}

function getColumnCount(nodes: Node<TableNodeData>[], targetAspect: number): number {
  if (nodes.length <= SMALL_COMPONENT_INLINE_LIMIT) {
    return nodes.length;
  }

  const averageSize = getAverageMeasuredSize(nodes);
  const columnPitch = averageSize.width + NODE_COLUMN_SPACING;
  const rowPitch = averageSize.height + NODE_ROW_SPACING;
  const estimatedColumns = Math.ceil(Math.sqrt((nodes.length * targetAspect * rowPitch) / columnPitch));

  return Math.max(2, Math.min(nodes.length, estimatedColumns));
}

function layoutComponent(
  orderedNodes: Node<TableNodeData>[],
  targetAspect: number,
): RelativeLayout {
  const columnCount = getColumnCount(orderedNodes, targetAspect);
  const placements = orderedNodes.map((node, index) => {
    const row = Math.floor(index / columnCount);
    const offset = index % columnCount;
    const column = row % 2 === 0 ? offset : columnCount - 1 - offset;
    return { node, row, column };
  });
  const columnWidths: number[] = [];
  const rowHeights: number[] = [];

  placements.forEach(({ node, row, column }) => {
    const size = measureErdNode(node);
    columnWidths[column] = Math.max(columnWidths[column] ?? 0, size.width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, size.height);
  });

  const columnX: number[] = [];
  for (let index = 0; index < columnWidths.length; index += 1) {
    columnX[index] = index === 0 ? 0 : columnX[index - 1] + columnWidths[index - 1] + NODE_COLUMN_SPACING;
  }

  const rowY: number[] = [];
  for (let index = 0; index < rowHeights.length; index += 1) {
    rowY[index] = index === 0 ? 0 : rowY[index - 1] + rowHeights[index - 1] + NODE_ROW_SPACING;
  }

  const laidOutNodes = placements.map(({ node, row, column }) => ({
    ...node,
    position: {
      x: columnX[column] ?? 0,
      y: rowY[row] ?? 0,
    },
  }));
  const bounds = getLayoutBounds(laidOutNodes);

  return {
    nodes: laidOutNodes,
    width: bounds.width,
    height: bounds.height,
  };
}

function packComponents(components: RelativeLayout[], targetAspect: number): Node<TableNodeData>[] {
  if (components.length === 0) {
    return [];
  }

  const averageSize = components.reduce(
    (acc, component) => ({
      width: acc.width + component.width / components.length,
      height: acc.height + component.height / components.length,
    }),
    { width: 0, height: 0 },
  );
  const columnCount =
    components.length <= SMALL_COMPONENT_INLINE_LIMIT
      ? components.length
      : Math.max(
          2,
          Math.min(
            components.length,
            Math.ceil(
              Math.sqrt(
                (components.length * targetAspect * (averageSize.height + COMPONENT_SPACING)) /
                  (averageSize.width + COMPONENT_SPACING),
              ),
            ),
          ),
        );
  const placements = components.map((component, index) => ({
    component,
    row: Math.floor(index / columnCount),
    column: index % columnCount,
  }));
  const columnWidths: number[] = [];
  const rowHeights: number[] = [];
  const packedNodes: Node<TableNodeData>[] = [];

  placements.forEach(({ component, row, column }) => {
    columnWidths[column] = Math.max(columnWidths[column] ?? 0, component.width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, component.height);
  });

  const columnX: number[] = [];
  for (let index = 0; index < columnWidths.length; index += 1) {
    columnX[index] = index === 0 ? LAYOUT_MARGIN : columnX[index - 1] + columnWidths[index - 1] + COMPONENT_SPACING;
  }

  const rowY: number[] = [];
  for (let index = 0; index < rowHeights.length; index += 1) {
    rowY[index] = index === 0 ? LAYOUT_MARGIN : rowY[index - 1] + rowHeights[index - 1] + COMPONENT_SPACING;
  }

  placements.forEach(({ component, row, column }) => {
    component.nodes.forEach((node) => {
      packedNodes.push({
        ...node,
        position: {
          x: node.position.x + (columnX[column] ?? LAYOUT_MARGIN),
          y: node.position.y + (rowY[row] ?? LAYOUT_MARGIN),
        },
      });
    });
  });

  return packedNodes;
}

function getNodeBox(node: Node<TableNodeData>) {
  const size = measureErdNode(node);
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + size.width,
    bottom: node.position.y + size.height,
  };
}

function boxesOverlap(left: ReturnType<typeof getNodeBox>, right: ReturnType<typeof getNodeBox>): boolean {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

function resolveLayoutCollisions(nodes: Node<TableNodeData>[]): Node<TableNodeData>[] {
  const resolvedNodes = nodes.map((node) => ({ ...node, position: { ...node.position } }));

  for (let pass = 0; pass < resolvedNodes.length; pass += 1) {
    let shifted = false;
    const orderedNodes = [...resolvedNodes].sort(
      (left, right) => left.position.y - right.position.y || left.position.x - right.position.x,
    );

    for (let leftIndex = 0; leftIndex < orderedNodes.length; leftIndex += 1) {
      const leftNode = orderedNodes[leftIndex];
      const leftBox = getNodeBox(leftNode);

      for (let rightIndex = leftIndex + 1; rightIndex < orderedNodes.length; rightIndex += 1) {
        const rightNode = orderedNodes[rightIndex];
        const rightBox = getNodeBox(rightNode);
        if (!boxesOverlap(leftBox, rightBox)) continue;

        const shiftX = leftBox.right - rightBox.left + COLLISION_SPACING;
        rightNode.position = {
          ...rightNode.position,
          x: rightNode.position.x + shiftX,
        };
        shifted = true;
      }
    }

    if (!shifted) break;
  }

  return resolvedNodes;
}

/**
 * ERD 참조관계를 기준으로 노드를 정렬하고, 긴 체인은 사각형 비율의 snake grid로 접어서 배치한다.
 *
 * ELK/Dagre 계층형 레이아웃은 긴 참조 체인을 한 방향으로 과도하게 늘리는 경향이 있어,
 * persisted ERD 자동정렬은 도메인 특화 배치로 처리한다.
 */
export async function applyErdLayout(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
  options: ErdLayoutOptions = {},
): Promise<ErdLayoutResult> {
  if (nodes.length === 0) {
    return { nodes, status: 'applied' };
  }

  try {
    const targetAspect = options.targetAspect ?? DEFAULT_TARGET_ASPECT;
    const originalIndexById = new Map(nodes.map((node, index) => [node.id, index]));
    const graph = buildGraphIndex(nodes, edges);
    const components = getWeakComponents(nodes, graph).map((componentNodes) =>
      layoutComponent(orderComponentNodes(componentNodes, graph, originalIndexById), targetAspect),
    );
    const packedNodes = resolveLayoutCollisions(packComponents(components, targetAspect));
    const nodesById = new Map(packedNodes.map((node) => [node.id, node]));

    return {
      nodes: nodes.map((node) => nodesById.get(node.id) ?? node),
      status: 'applied',
    };
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
