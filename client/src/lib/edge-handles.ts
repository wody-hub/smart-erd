import type { Node } from '@xyflow/react';
import type { EdgeHandleMode, EdgeHandleSide, TableHandleLayout } from '../types/erd.js';
import { buildColumnHandleId, type ColumnHandleSide } from './handle-id.js';

const DEFAULT_NODE_WIDTH = 420;
const STACKED_OVERLAP_RATIO = 0.25;

export interface RelationKeyParts {
  parentTable: string;
  parentColumn: string;
  childTable: string;
  childColumn: string;
}

export interface AutoEdgeHandleResolution {
  sourceHandle: string;
  targetHandle: string;
  sourceSide: ColumnHandleSide;
  targetSide: ColumnHandleSide;
}

export type EdgeHandleSelectionValue =
  | 'auto'
  | 'left-left'
  | 'left-right'
  | 'right-left'
  | 'right-right';

export interface EdgeHandleResolution extends AutoEdgeHandleResolution {
  handleMode: EdgeHandleMode;
}

type TableNodeLike = Pick<Node, 'id' | 'position' | 'width'> & {
  data: {
    handleLayout?: TableHandleLayout;
  };
  measured?: { width?: number };
};

const EDGE_HANDLE_SELECTION_VALUES: EdgeHandleSelectionValue[] = [
  'auto',
  'left-left',
  'left-right',
  'right-left',
  'right-right',
];

export function getAllEdgeHandleSelectionValues(): EdgeHandleSelectionValue[] {
  return [...EDGE_HANDLE_SELECTION_VALUES];
}

export function buildRelationKey(parts: RelationKeyParts): string {
  return `${parts.parentTable}.${parts.parentColumn}->${parts.childTable}.${parts.childColumn}`;
}

export function buildStableEdgeId(parts: RelationKeyParts): string {
  return `rel:${encodeURIComponent(buildRelationKey(parts))}`;
}

export function getAllowedHandleSides(layout: TableHandleLayout | undefined): ColumnHandleSide[] {
  if (layout === 'left') {
    return ['left'];
  }
  if (layout === 'right') {
    return ['right'];
  }
  return ['left', 'right'];
}

export function buildEdgeHandleSelectionValue(
  sourceSide: EdgeHandleSide,
  targetSide: EdgeHandleSide,
): EdgeHandleSelectionValue {
  return `${sourceSide}-${targetSide}`;
}

export function parseEdgeHandleSelectionValue(value: EdgeHandleSelectionValue): {
  handleMode: EdgeHandleMode;
  sourceSide?: ColumnHandleSide;
  targetSide?: ColumnHandleSide;
} {
  if (value === 'auto') {
    return { handleMode: 'auto' };
  }
  const [sourceSide, targetSide] = value.split('-') as [ColumnHandleSide, ColumnHandleSide];
  return {
    handleMode: 'manual',
    sourceSide,
    targetSide,
  };
}

export function getAllowedEdgeHandleSelectionValues(
  sourceLayout: TableHandleLayout | undefined,
  targetLayout: TableHandleLayout | undefined,
): EdgeHandleSelectionValue[] {
  const sourceSides = getAllowedHandleSides(sourceLayout);
  const targetSides = getAllowedHandleSides(targetLayout);

  const values: EdgeHandleSelectionValue[] = ['auto'];
  for (const sourceSide of sourceSides) {
    for (const targetSide of targetSides) {
      values.push(buildEdgeHandleSelectionValue(sourceSide, targetSide));
    }
  }
  return values;
}

export function getCurrentEdgeHandleSelectionValue(params: {
  handleMode?: EdgeHandleMode;
  sourceSide?: EdgeHandleSide;
  targetSide?: EdgeHandleSide;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): EdgeHandleSelectionValue {
  if (params.handleMode === 'manual') {
    const sourceSide = params.sourceSide ?? extractResolvedHandleSide(params.sourceHandle, 'right');
    const targetSide = params.targetSide ?? extractResolvedHandleSide(params.targetHandle, 'left');
    return buildEdgeHandleSelectionValue(sourceSide, targetSide);
  }
  return 'auto';
}

export function resolveEdgeHandlesFromPreference(params: {
  sourceNode: TableNodeLike;
  targetNode: TableNodeLike;
  sourceColId: string;
  targetColId: string;
  handleMode?: EdgeHandleMode;
  sourceSide?: EdgeHandleSide;
  targetSide?: EdgeHandleSide;
}): EdgeHandleResolution {
  const { sourceNode, targetNode, sourceColId, targetColId, handleMode, sourceSide, targetSide } =
    params;

  if (handleMode === 'manual' && sourceSide && targetSide) {
    return resolveManualEdgeHandles({
      sourceNode,
      targetNode,
      sourceColId,
      targetColId,
      sourceSide,
      targetSide,
    });
  }

  return {
    handleMode: 'auto',
    ...resolveAutoEdgeHandles({
      sourceNode,
      targetNode,
      sourceColId,
      targetColId,
    }),
  };
}

export function resolveAutoEdgeHandles(params: {
  sourceNode: TableNodeLike;
  targetNode: TableNodeLike;
  sourceColId: string;
  targetColId: string;
}): AutoEdgeHandleResolution {
  const { sourceNode, targetNode, sourceColId, targetColId } = params;
  const sourceBounds = getNodeBounds(sourceNode);
  const targetBounds = getNodeBounds(targetNode);
  const sourceAllowedSides = getAllowedHandleSides(sourceNode.data.handleLayout);
  const targetAllowedSides = getAllowedHandleSides(targetNode.data.handleLayout);
  const stackedOverlap = isStackedOverlap(sourceBounds, targetBounds);
  const preferredPairs = getPreferredPairs(sourceBounds, targetBounds);

  if (stackedOverlap) {
    for (const [sourceSide, targetSide] of preferredPairs) {
      if (!sourceAllowedSides.includes(sourceSide) || !targetAllowedSides.includes(targetSide)) {
        continue;
      }
      return {
        sourceSide,
        targetSide,
        sourceHandle: buildColumnHandleId(sourceNode.id, sourceColId, 'source', sourceSide),
        targetHandle: buildColumnHandleId(targetNode.id, targetColId, 'target', targetSide),
      };
    }
  }

  let best:
    | (AutoEdgeHandleResolution & {
        cost: number;
        preferenceRank: number;
      })
    | null = null;

  for (const sourceSide of sourceAllowedSides) {
    for (const targetSide of targetAllowedSides) {
      const cost = Math.abs(
        getSideX(sourceBounds, sourceSide) - getSideX(targetBounds, targetSide),
      );
      const preferenceRank = preferredPairs.findIndex(
        (pair) => pair[0] === sourceSide && pair[1] === targetSide,
      );
      const candidate = {
        sourceSide,
        targetSide,
        sourceHandle: buildColumnHandleId(sourceNode.id, sourceColId, 'source', sourceSide),
        targetHandle: buildColumnHandleId(targetNode.id, targetColId, 'target', targetSide),
        cost,
        preferenceRank: preferenceRank === -1 ? Number.MAX_SAFE_INTEGER : preferenceRank,
      };

      if (
        !best ||
        candidate.cost < best.cost ||
        (candidate.cost === best.cost && candidate.preferenceRank < best.preferenceRank)
      ) {
        best = candidate;
      }
    }
  }

  if (best) {
    return best;
  }

  return {
    sourceSide: 'right',
    targetSide: 'left',
    sourceHandle: buildColumnHandleId(sourceNode.id, sourceColId, 'source', 'right'),
    targetHandle: buildColumnHandleId(targetNode.id, targetColId, 'target', 'left'),
  };
}

function resolveManualEdgeHandles(params: {
  sourceNode: TableNodeLike;
  targetNode: TableNodeLike;
  sourceColId: string;
  targetColId: string;
  sourceSide: ColumnHandleSide;
  targetSide: ColumnHandleSide;
}): EdgeHandleResolution {
  const { sourceNode, targetNode, sourceColId, targetColId, sourceSide, targetSide } = params;
  const sourceAllowedSides = getAllowedHandleSides(sourceNode.data.handleLayout);
  const targetAllowedSides = getAllowedHandleSides(targetNode.data.handleLayout);
  const effectiveSourceSide = sourceAllowedSides.includes(sourceSide)
    ? sourceSide
    : (sourceAllowedSides[0] ?? 'right');
  const effectiveTargetSide = targetAllowedSides.includes(targetSide)
    ? targetSide
    : (targetAllowedSides[0] ?? 'left');

  return {
    handleMode: 'manual',
    sourceSide: effectiveSourceSide,
    targetSide: effectiveTargetSide,
    sourceHandle: buildColumnHandleId(sourceNode.id, sourceColId, 'source', effectiveSourceSide),
    targetHandle: buildColumnHandleId(targetNode.id, targetColId, 'target', effectiveTargetSide),
  };
}

function getNodeBounds(node: TableNodeLike): {
  left: number;
  right: number;
  centerX: number;
  width: number;
} {
  const left = node.position.x;
  const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  return {
    left,
    right: left + width,
    centerX: left + width / 2,
    width,
  };
}

function getSideX(bounds: { left: number; right: number }, side: ColumnHandleSide): number {
  return side === 'left' ? bounds.left : bounds.right;
}

function getPreferredPairs(
  sourceBounds: { left: number; right: number; centerX: number; width: number },
  targetBounds: { left: number; right: number; centerX: number; width: number },
): ReadonlyArray<readonly [ColumnHandleSide, ColumnHandleSide]> {
  if (isStackedOverlap(sourceBounds, targetBounds)) {
    if (sourceBounds.centerX <= targetBounds.centerX) {
      return [
        ['right', 'right'],
        ['left', 'left'],
        ['right', 'left'],
        ['left', 'right'],
      ] as const;
    }

    return [
      ['left', 'left'],
      ['right', 'right'],
      ['left', 'right'],
      ['right', 'left'],
    ] as const;
  }

  if (sourceBounds.centerX <= targetBounds.centerX) {
    return [
      ['right', 'left'],
      ['left', 'left'],
      ['right', 'right'],
      ['left', 'right'],
    ] as const;
  }

  return [
    ['left', 'right'],
    ['left', 'left'],
    ['right', 'right'],
    ['right', 'left'],
  ] as const;
}

function isStackedOverlap(
  sourceBounds: { left: number; right: number; width: number },
  targetBounds: { left: number; right: number; width: number },
): boolean {
  const overlapWidth =
    Math.min(sourceBounds.right, targetBounds.right) -
    Math.max(sourceBounds.left, targetBounds.left);
  if (overlapWidth <= 0) {
    return false;
  }
  const smallerWidth = Math.min(sourceBounds.width, targetBounds.width);
  return overlapWidth >= smallerWidth * STACKED_OVERLAP_RATIO;
}

function extractResolvedHandleSide(
  handleId: string | null | undefined,
  fallback: ColumnHandleSide,
): ColumnHandleSide {
  if (handleId?.endsWith('-left')) {
    return 'left';
  }
  if (handleId?.endsWith('-right')) {
    return 'right';
  }
  return fallback;
}
