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

type ErdTableRole = 'hub' | 'mapping' | 'detail' | 'history' | 'leaf' | 'regular';

interface ErdNodeLayoutMeta {
  id: string;
  role: ErdTableRole;
  originalIndex: number;
  incomingCount: number;
  outgoingCount: number;
  undirectedDegree: number;
  hubScore: number;
}

interface RankedNodePlacement {
  node: Node<TableNodeData>;
  rank: number;
  lane: number;
  column: number;
  row: number;
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

function getNodeSearchText(node: Node<TableNodeData>): string {
  return [
    node.id,
    node.data.label,
    node.data.logicalTableName,
    ...((node.data.columns ?? []).flatMap((column) => [column.name, column.logicalName]) ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function classifyErdTable(node: Node<TableNodeData>, graph: GraphIndex): ErdTableRole {
  const searchText = getNodeSearchText(node);
  const incomingCount = graph.incoming.get(node.id)?.size ?? 0;
  const outgoingCount = graph.outgoing.get(node.id)?.size ?? 0;
  const undirectedDegree = graph.undirected.get(node.id)?.size ?? 0;

  if (/\b(mapping|map|rel|relation|xref)\b|_mapping|_map|_rel/.test(searchText)) {
    return 'mapping';
  }
  if (/\b(history|log|audit)\b|_history|_log|_audit/.test(searchText)) {
    return 'history';
  }
  if (/\b(item|detail|attendee|participant)\b|_item|_detail|_attendee|_participant/.test(searchText)) {
    return 'detail';
  }
  if (undirectedDegree >= 4 || outgoingCount >= 4) {
    return 'hub';
  }
  if (incomingCount > 0 && outgoingCount === 0) {
    return 'leaf';
  }
  return 'regular';
}

function buildNodeLayoutMeta(
  nodes: Node<TableNodeData>[],
  graph: GraphIndex,
  originalIndexById: Map<string, number>,
): Map<string, ErdNodeLayoutMeta> {
  return new Map(
    nodes.map((node) => {
      const incomingCount = graph.incoming.get(node.id)?.size ?? 0;
      const outgoingCount = graph.outgoing.get(node.id)?.size ?? 0;
      const undirectedDegree = graph.undirected.get(node.id)?.size ?? 0;

      return [
        node.id,
        {
          id: node.id,
          role: classifyErdTable(node, graph),
          originalIndex: originalIndexById.get(node.id) ?? 0,
          incomingCount,
          outgoingCount,
          undirectedDegree,
          hubScore: incomingCount + outgoingCount + undirectedDegree,
        },
      ];
    }),
  );
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
  metaById?: Map<string, ErdNodeLayoutMeta>,
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
      if (levelDelta !== 0) return levelDelta;

      const leftMeta = metaById?.get(left.id);
      const rightMeta = metaById?.get(right.id);
      const hubDelta = (rightMeta?.hubScore ?? 0) - (leftMeta?.hubScore ?? 0);
      if (hubDelta !== 0) return hubDelta;

      return orderedIds.indexOf(left.id) - orderedIds.indexOf(right.id);
    });
}

function getRoleRankAdjustment(role: ErdTableRole): number {
  if (role === 'hub') return -1;
  if (role === 'mapping' || role === 'detail' || role === 'history' || role === 'leaf') return 1;
  return 0;
}

function assignHierarchicalRanks(
  componentNodes: Node<TableNodeData>[],
  graph: GraphIndex,
  metaById: Map<string, ErdNodeLayoutMeta>,
): Map<string, number> {
  const componentIds = new Set(componentNodes.map((node) => node.id));
  const indegree = new Map<string, number>();
  const rankById = new Map<string, number>();

  componentNodes.forEach((node) => {
    const incomingCount = Array.from(graph.incoming.get(node.id) ?? []).filter((id) => componentIds.has(id)).length;
    indegree.set(node.id, incomingCount);
    rankById.set(node.id, 0);
  });

  const compareByStructure = (left: Node<TableNodeData>, right: Node<TableNodeData>) => {
    const leftMeta = metaById.get(left.id);
    const rightMeta = metaById.get(right.id);
    const roleDelta = getRoleRankAdjustment(leftMeta?.role ?? 'regular') - getRoleRankAdjustment(rightMeta?.role ?? 'regular');
    if (roleDelta !== 0) return roleDelta;
    return (leftMeta?.originalIndex ?? 0) - (rightMeta?.originalIndex ?? 0);
  };

  const ready = componentNodes.filter((node) => indegree.get(node.id) === 0).sort(compareByStructure);
  const visited = new Set<string>();

  while (ready.length > 0) {
    const node = ready.shift();
    if (!node || visited.has(node.id)) continue;

    visited.add(node.id);
    const sourceRank = rankById.get(node.id) ?? 0;
    Array.from(graph.outgoing.get(node.id) ?? [])
      .filter((targetId) => componentIds.has(targetId))
      .sort((left, right) => (metaById.get(left)?.originalIndex ?? 0) - (metaById.get(right)?.originalIndex ?? 0))
      .forEach((targetId) => {
        rankById.set(targetId, Math.max(rankById.get(targetId) ?? 0, sourceRank + 1));
        indegree.set(targetId, Math.max(0, (indegree.get(targetId) ?? 0) - 1));
        if (indegree.get(targetId) === 0) {
          const targetNode = componentNodes.find((candidate) => candidate.id === targetId);
          if (targetNode) {
            ready.push(targetNode);
            ready.sort(compareByStructure);
          }
        }
      });
  }

  componentNodes
    .filter((node) => !visited.has(node.id))
    .sort(compareByStructure)
    .forEach((node) => {
      const predecessorRank = Array.from(graph.incoming.get(node.id) ?? [])
        .filter((id) => componentIds.has(id) && rankById.has(id))
        .reduce((maxRank, id) => Math.max(maxRank, rankById.get(id) ?? 0), -1);
      rankById.set(node.id, Math.max(rankById.get(node.id) ?? 0, predecessorRank + 1));
    });

  componentNodes.forEach((node) => {
    const meta = metaById.get(node.id);
    if (!meta) return;

    const parentRank = Array.from(graph.incoming.get(node.id) ?? [])
      .filter((id) => componentIds.has(id))
      .reduce((maxRank, id) => Math.max(maxRank, rankById.get(id) ?? 0), -1);
    const adjustedRank = Math.max(0, (rankById.get(node.id) ?? 0) + getRoleRankAdjustment(meta.role));

    if (parentRank >= 0 && meta.role !== 'hub') {
      rankById.set(node.id, Math.max(parentRank + 1, adjustedRank));
    } else {
      rankById.set(node.id, adjustedRank);
    }
  });

  const distinctRanks = Array.from(new Set(rankById.values())).sort((left, right) => left - right);
  const normalizedRankById = new Map(distinctRanks.map((rank, index) => [rank, index]));
  componentNodes.forEach((node) => {
    rankById.set(node.id, normalizedRankById.get(rankById.get(node.id) ?? 0) ?? 0);
  });

  return rankById;
}

function groupNodesByRank(
  componentNodes: Node<TableNodeData>[],
  rankById: Map<string, number>,
): Map<number, Node<TableNodeData>[]> {
  const groups = new Map<number, Node<TableNodeData>[]>();
  componentNodes.forEach((node) => {
    const rank = rankById.get(node.id) ?? 0;
    groups.set(rank, [...(groups.get(rank) ?? []), node]);
  });
  return groups;
}

function getRoleOrderPriority(role: ErdTableRole): number {
  if (role === 'hub') return 0;
  if (role === 'mapping') return 1;
  if (role === 'regular') return 2;
  if (role === 'detail') return 3;
  if (role === 'history') return 4;
  return 5;
}

function getNeighborOrderAverage(
  nodeId: string,
  graph: GraphIndex,
  knownOrderById: Map<string, number>,
): number {
  const neighborOrders = [
    ...Array.from(graph.incoming.get(nodeId) ?? []),
    ...Array.from(graph.outgoing.get(nodeId) ?? []),
  ]
    .map((id) => knownOrderById.get(id))
    .filter((order): order is number => typeof order === 'number');

  if (neighborOrders.length === 0) return Number.POSITIVE_INFINITY;
  return neighborOrders.reduce((sum, order) => sum + order, 0) / neighborOrders.length;
}

function orderRanksByRelationshipWeight(
  rankGroups: Map<number, Node<TableNodeData>[]>,
  graph: GraphIndex,
  metaById: Map<string, ErdNodeLayoutMeta>,
): Map<number, Node<TableNodeData>[]> {
  const orderedGroups = new Map<number, Node<TableNodeData>[]>();
  const knownOrderById = new Map<string, number>();

  Array.from(rankGroups.keys())
    .sort((left, right) => left - right)
    .forEach((rank) => {
      const orderedNodes = [...(rankGroups.get(rank) ?? [])].sort((left, right) => {
        const leftAverage = getNeighborOrderAverage(left.id, graph, knownOrderById);
        const rightAverage = getNeighborOrderAverage(right.id, graph, knownOrderById);
        if (leftAverage !== rightAverage) return leftAverage - rightAverage;

        const leftMeta = metaById.get(left.id);
        const rightMeta = metaById.get(right.id);
        const roleDelta = getRoleOrderPriority(leftMeta?.role ?? 'regular') - getRoleOrderPriority(rightMeta?.role ?? 'regular');
        if (roleDelta !== 0) return roleDelta;

        const hubDelta = (leftMeta?.hubScore ?? 0) - (rightMeta?.hubScore ?? 0);
        if (hubDelta !== 0) return hubDelta;

        return (leftMeta?.originalIndex ?? 0) - (rightMeta?.originalIndex ?? 0);
      });

      orderedGroups.set(rank, orderedNodes);
      orderedNodes.forEach((node, index) => {
        knownOrderById.set(node.id, index);
      });
    });

  return orderedGroups;
}

function getRankColumnStagger(column: number): number {
  return column % 2 === 0 ? 0 : NODE_ROW_SPACING;
}

function measureWrappedRankBounds(
  ranks: number[],
  rankWidths: Map<number, number>,
  rankHeights: Map<number, number>,
  columnCount: number,
): MeasuredSize {
  const columnWidths: number[] = [];
  const laneHeights: number[] = [];

  ranks.forEach((rank, index) => {
    const lane = Math.floor(index / columnCount);
    const column = index % columnCount;
    columnWidths[column] = Math.max(columnWidths[column] ?? 0, rankWidths.get(rank) ?? MIN_RENDERED_NODE_WIDTH);
    laneHeights[lane] = Math.max(laneHeights[lane] ?? 0, (rankHeights.get(rank) ?? 0) + getRankColumnStagger(column));
  });

  return {
    width: columnWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, columnWidths.length - 1) * NODE_COLUMN_SPACING,
    height: laneHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, laneHeights.length - 1) * NODE_ROW_SPACING * 2,
  };
}

function getTargetRankColumnCount(
  ranks: number[],
  rankWidths: Map<number, number>,
  rankHeights: Map<number, number>,
  targetAspect: number,
): number {
  if (ranks.length <= 4) return ranks.length;

  let bestColumnCount = 2;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let columnCount = 2; columnCount <= ranks.length; columnCount += 1) {
    const bounds = measureWrappedRankBounds(ranks, rankWidths, rankHeights, columnCount);
    if (bounds.width === 0 || bounds.height === 0) continue;

    const directionalAspect = bounds.width / bounds.height;
    const aspectScore = Math.abs(Math.log(directionalAspect / targetAspect));
    const overStretchPenalty = Math.max(0, directionalAspect - targetAspect * 1.4);
    const score = aspectScore + overStretchPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestColumnCount = columnCount;
    }
  }

  return bestColumnCount;
}

function layoutHierarchicalComponent(
  componentNodes: Node<TableNodeData>[],
  graph: GraphIndex,
  originalIndexById: Map<string, number>,
  metaById: Map<string, ErdNodeLayoutMeta>,
  targetAspect: number,
): RelativeLayout {
  const hasRelationships = componentNodes.some(
    (node) => (graph.incoming.get(node.id)?.size ?? 0) > 0 || (graph.outgoing.get(node.id)?.size ?? 0) > 0,
  );
  if (!hasRelationships) {
    return layoutComponent(orderComponentNodes(componentNodes, graph, originalIndexById, metaById), targetAspect);
  }

  const rankById = assignHierarchicalRanks(componentNodes, graph, metaById);
  const orderedGroups = orderRanksByRelationshipWeight(groupNodesByRank(componentNodes, rankById), graph, metaById);
  const ranks = Array.from(orderedGroups.keys()).sort((left, right) => left - right);
  const rankWidths = new Map<number, number>();
  const rankHeights = new Map<number, number>();

  ranks.forEach((rank) => {
    const nodes = orderedGroups.get(rank) ?? [];
    const measuredNodes = nodes.map((node) => measureErdNode(node));
    rankWidths.set(rank, measuredNodes.reduce((maxWidth, size) => Math.max(maxWidth, size.width), 0));
    rankHeights.set(
      rank,
      measuredNodes.reduce((height, size, index) => height + size.height + (index === 0 ? 0 : NODE_ROW_SPACING), 0),
    );
  });

  const rankColumnCount = getTargetRankColumnCount(ranks, rankWidths, rankHeights, targetAspect);
  const rankEntries = ranks.map((rank, index) => ({
    rank,
    lane: Math.floor(index / rankColumnCount),
    column: index % rankColumnCount,
  }));
  const columnWidths: number[] = [];
  const laneHeights: number[] = [];

  rankEntries.forEach(({ rank, lane, column }) => {
    const rankHeight = rankHeights.get(rank) ?? 0;
    columnWidths[column] = Math.max(columnWidths[column] ?? 0, rankWidths.get(rank) ?? MIN_RENDERED_NODE_WIDTH);
    laneHeights[lane] = Math.max(laneHeights[lane] ?? 0, rankHeight + getRankColumnStagger(column));
  });

  const columnX: number[] = [];
  for (let index = 0; index < columnWidths.length; index += 1) {
    columnX[index] = index === 0 ? 0 : columnX[index - 1] + columnWidths[index - 1] + NODE_COLUMN_SPACING;
  }

  const laneY: number[] = [];
  for (let index = 0; index < laneHeights.length; index += 1) {
    laneY[index] = index === 0 ? 0 : laneY[index - 1] + laneHeights[index - 1] + NODE_ROW_SPACING * 2;
  }

  const placements: RankedNodePlacement[] = [];
  rankEntries.forEach(({ rank, lane, column }) => {
    const nodes = orderedGroups.get(rank) ?? [];
    nodes.forEach((node, row) => {
      placements.push({ node, rank, lane, column, row });
    });
  });

  const rankCursorY = new Map<number, number>();
  const laidOutNodes = placements.map(({ node, rank, lane, column }) => {
    const size = measureErdNode(node);
    const rankHeight = rankHeights.get(rank) ?? size.height;
    const staggerY = getRankColumnStagger(column);
    const startY = (laneY[lane] ?? 0) + ((laneHeights[lane] ?? rankHeight) - rankHeight - staggerY) / 2 + staggerY;
    const currentY = rankCursorY.get(rank) ?? startY;
    rankCursorY.set(rank, currentY + size.height + NODE_ROW_SPACING);

    return {
      ...node,
      position: {
        x: columnX[column] ?? 0,
        y: currentY,
      },
    };
  });
  const bounds = getLayoutBounds(laidOutNodes);

  return {
    nodes: laidOutNodes,
    width: bounds.width,
    height: bounds.height,
  };
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
    const metaById = buildNodeLayoutMeta(nodes, graph, originalIndexById);
    const components = getWeakComponents(nodes, graph).map((componentNodes) =>
      layoutHierarchicalComponent(componentNodes, graph, originalIndexById, metaById, targetAspect),
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
