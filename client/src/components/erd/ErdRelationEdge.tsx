import { useCallback, useMemo } from 'react';
import {
  type EdgeProps,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  useStore,
  useReactFlow,
  BaseEdge,
  type Position,
} from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import type { EdgeRoutingType, RelationType, TableNodeData, Waypoint } from '@/types/erd';
import { extractColId, extractHandleSide } from '@/lib/handle-id';
import { cn } from '@/lib/utils';
import { useEdgeEditingContext } from './EdgeEditingContext';
import {
  buildRoundedOrthogonalSvgPath,
  buildOrthogonalRouteSegments,
  buildStraightEdgePoints,
} from './edgeWaypointGeometry';
import { buildObstacleAvoidingAutoRoute } from './edgeAutoRoute';

/** 카디널리티 기호 유형 */
type CardinalitySymbol = 'one' | 'many';

/** 카디널리티 계산 결과 */
interface Cardinality {
  sourceSymbol: CardinalitySymbol;
  targetSymbol: CardinalitySymbol;
  optional: boolean;
}

function computeCardinality(
  relationType: RelationType,
  targetNodeId: string,
  targetHandle: string | null | undefined,
  childData: TableNodeData | undefined,
): Cardinality {
  const sourceSymbol: CardinalitySymbol = 'one';

  let targetSymbol: CardinalitySymbol = 'many';
  let optional = true;

  if (childData) {
    if (targetHandle) {
      const colId = extractColId(targetHandle, targetNodeId);
      const fkCol = childData.columns.find((c) => c.id === colId);
      optional = fkCol?.nullable !== false;
    }

    if (relationType === 'identifying') {
      const pkCols = childData.columns.filter((c) => c.pk);
      const fkPkCols = pkCols.filter((c) => c.fk);
      targetSymbol = fkPkCols.length > 0 && fkPkCols.length === pkCols.length ? 'one' : 'many';
    }
  }

  return { sourceSymbol, targetSymbol, optional };
}

const SOURCE_MARKER_OFFSET = 12;
const TARGET_MARKER_OFFSET = 14;
const CROW_FOOT_SPREAD = 8;
const SEGMENT_HANDLE_THICKNESS = 18;
const SEGMENT_GRIP_LENGTH = 24;
const SEGMENT_GRIP_THICKNESS = 4;
const DEFAULT_NODE_WIDTH = 420;
const DEFAULT_NODE_BASE_HEIGHT = 52;
const DEFAULT_NODE_ROW_HEIGHT = 30;

function buildSegmentHandleStyle(
  start: { x: number; y: number },
  end: { x: number; y: number },
): React.CSSProperties {
  const isHorizontal = start.y === end.y;
  const width = isHorizontal ? Math.max(Math.abs(end.x - start.x), 12) : SEGMENT_HANDLE_THICKNESS;
  const height = isHorizontal ? SEGMENT_HANDLE_THICKNESS : Math.max(Math.abs(end.y - start.y), 12);

  return {
    position: 'absolute',
    transform: `translate(-50%, -50%) translate(${(start.x + end.x) / 2}px, ${(start.y + end.y) / 2}px)`,
    pointerEvents: 'all',
    zIndex: 40,
    width,
    height,
  };
}

function getEdgePathByRoutingType(input: {
  routingType: EdgeRoutingType;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  waypoints: Waypoint[];
  sourceDirection: number;
  targetDirection: number;
  autoRoutePoints?: Array<{ x: number; y: number }> | null;
}): string {
  const {
    routingType,
    waypoints,
    sourceDirection,
    targetDirection,
    autoRoutePoints,
    ...pathInput
  } = input;
  const adjustedPathInput = {
    ...pathInput,
    sourceX: pathInput.sourceX + sourceDirection * SOURCE_MARKER_OFFSET,
    targetX: pathInput.targetX + targetDirection * TARGET_MARKER_OFFSET,
  };
  if (routingType === 'bezier') {
    const [path] = getBezierPath(adjustedPathInput);
    return path;
  }
  if (routingType === 'straight') {
    return buildRoundedOrthogonalSvgPath(
      buildStraightEdgePoints({
        sourceX: pathInput.sourceX,
        sourceY: pathInput.sourceY,
        targetX: pathInput.targetX,
        targetY: pathInput.targetY,
        sourceDirection,
        targetDirection,
        sourceMarkerOffset: SOURCE_MARKER_OFFSET,
        targetMarkerOffset: TARGET_MARKER_OFFSET,
        waypoints,
      }),
    );
  }
  if (autoRoutePoints && autoRoutePoints.length > 1) {
    return buildRoundedOrthogonalSvgPath(autoRoutePoints, 8);
  }
  const [path] = getSmoothStepPath({
    ...adjustedPathInput,
    borderRadius: 8,
  });
  return path;
}

function estimateNodeHeight(data: TableNodeData | undefined): number {
  return DEFAULT_NODE_BASE_HEIGHT + (data?.columns.length ?? 0) * DEFAULT_NODE_ROW_HEIGHT;
}

function renderOneMarker(x: number, y: number, direction: number, stroke: string) {
  const lineX = x + direction * 8;
  return (
    <g>
      <line x1={lineX} y1={y - 6} x2={lineX} y2={y + 6} stroke={stroke} strokeWidth={1.5} />
    </g>
  );
}

function renderTargetMarker(
  x: number,
  y: number,
  direction: number,
  symbol: CardinalitySymbol,
  optional: boolean,
  stroke: string,
) {
  const elements: React.ReactNode[] = [];

  if (optional) {
    const optX = x + direction * (TARGET_MARKER_OFFSET - 2);
    elements.push(
      <circle
        key="opt"
        cx={optX}
        cy={y}
        r={4}
        fill="hsl(var(--background))"
        stroke={stroke}
        strokeWidth={1.5}
      />,
    );
  }

  if (symbol === 'many') {
    const baseX = x;
    const tipX = x + direction * 12;
    elements.push(
      <g key="crow">
        <line
          x1={baseX}
          y1={y - CROW_FOOT_SPREAD}
          x2={tipX}
          y2={y}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <line x1={baseX} y1={y} x2={tipX} y2={y} stroke={stroke} strokeWidth={1.5} />
        <line
          x1={baseX}
          y1={y + CROW_FOOT_SPREAD}
          x2={tipX}
          y2={y}
          stroke={stroke}
          strokeWidth={1.5}
        />
      </g>,
    );
  } else {
    const lineX = x + direction * 8;
    elements.push(
      <line
        key="one"
        x1={lineX}
        y1={y - 6}
        x2={lineX}
        y2={y + 6}
        stroke={stroke}
        strokeWidth={1.5}
      />,
    );
  }

  return <g>{elements}</g>;
}

export default function ErdRelationEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceHandleId,
  data,
  target,
  targetHandleId,
  style,
  selected,
}: EdgeProps) {
  const { t } = useTranslation();
  const reactFlowInstance = useReactFlow();
  const relationType: RelationType =
    (data as { relationType?: RelationType } | undefined)?.relationType ?? 'non-identifying';
  const routingType: EdgeRoutingType =
    (data as { routingType?: EdgeRoutingType } | undefined)?.routingType ?? 'smoothstep';
  const committedWaypoints = ((data as { waypoints?: Waypoint[] } | undefined)?.waypoints ??
    []) as Waypoint[];
  const childData = useStore(
    useCallback(
      (s) => {
        const childNode = s.nodes.find((n) => n.id === target);
        return childNode?.data as TableNodeData | undefined;
      },
      [target],
    ),
  );
  const obstacleRects = useStore(
    useCallback(
      (s) => {
        if (routingType !== 'smoothstep') {
          return [];
        }

        return s.nodes
          .filter(
            (node) =>
              node.id !== source &&
              node.id !== target &&
              (node.type === 'table' || node.type === 'previewTable'),
          )
          .map((node) => {
            const tableData = node.data as TableNodeData | undefined;
            const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
            const height = node.measured?.height ?? node.height ?? estimateNodeHeight(tableData);
            return {
              left: node.position.x,
              right: node.position.x + width,
              top: node.position.y,
              bottom: node.position.y + height,
            };
          });
      },
      [routingType, source, target],
    ),
  );
  const { edgeLocksById, edgePreviewsById, localEdgeDrag, beginSegmentDrag, splitSegment } =
    useEdgeEditingContext();
  const localPreviewWaypoints =
    localEdgeDrag?.edgeId === id ? localEdgeDrag.previewWaypoints : null;
  const remotePreviewWaypoints = edgePreviewsById.get(id)?.waypoints ?? null;
  const displayWaypoints = localPreviewWaypoints ?? remotePreviewWaypoints ?? committedWaypoints;
  const lockInfo = edgeLocksById.get(id) ?? null;

  const { sourceSymbol, targetSymbol, optional } = computeCardinality(
    relationType,
    target,
    targetHandleId,
    childData,
  );

  const resolvedSourcePosition = (
    extractHandleSide(sourceHandleId ?? '') === 'left' ? 'left' : 'right'
  ) as Position;
  const resolvedTargetPosition = (
    extractHandleSide(targetHandleId ?? '') === 'left' ? 'left' : 'right'
  ) as Position;

  const sourceDirection = resolvedSourcePosition === ('left' as Position) ? -1 : 1;
  const targetDirection = resolvedTargetPosition === ('left' as Position) ? -1 : 1;
  const autoRoutePoints = useMemo(
    () =>
      routingType === 'smoothstep'
        ? buildObstacleAvoidingAutoRoute(
            {
              sourceX,
              sourceY,
              targetX,
              targetY,
              sourceDirection,
              targetDirection,
              sourceMarkerOffset: SOURCE_MARKER_OFFSET,
              targetMarkerOffset: TARGET_MARKER_OFFSET,
              waypoints: [],
            },
            obstacleRects,
          )
        : null,
    [
      obstacleRects,
      routingType,
      sourceDirection,
      sourceX,
      sourceY,
      targetDirection,
      targetX,
      targetY,
    ],
  );

  const edgePath = getEdgePathByRoutingType({
    routingType,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: resolvedSourcePosition,
    targetPosition: resolvedTargetPosition,
    waypoints: displayWaypoints,
    sourceDirection,
    targetDirection,
    autoRoutePoints,
  });

  const edgeStyle = style as React.CSSProperties | undefined;
  const strokeColor =
    (edgeStyle?.stroke as string) ??
    (selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))');
  const strokeWidth = selected ? 2.5 : 1.5;

  const routePoints =
    routingType === 'straight'
      ? buildStraightEdgePoints({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourceDirection,
          targetDirection,
          sourceMarkerOffset: SOURCE_MARKER_OFFSET,
          targetMarkerOffset: TARGET_MARKER_OFFSET,
          waypoints: displayWaypoints,
        })
      : [];
  const routeSegments =
    routingType === 'straight'
      ? buildOrthogonalRouteSegments({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourceDirection,
          targetDirection,
          sourceMarkerOffset: SOURCE_MARKER_OFFSET,
          targetMarkerOffset: TARGET_MARKER_OFFSET,
          waypoints: displayWaypoints,
        })
      : [];
  const lockBadgePoint = routeSegments[Math.floor(routeSegments.length / 2)]?.center ?? {
    x: (sourceX + targetX) / 2,
    y: (sourceY + targetY) / 2,
  };
  const isEditing = selected || localEdgeDrag?.edgeId === id;
  const showSegmentControls = routingType === 'straight' && isEditing;

  return (
    <g>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...edgeStyle,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: relationType === 'identifying' ? 'none' : '6 3',
        }}
      />

      {sourceSymbol === 'one' && renderOneMarker(sourceX, sourceY, sourceDirection, strokeColor)}
      {renderTargetMarker(targetX, targetY, targetDirection, targetSymbol, optional, strokeColor)}

      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />

      {selected && lockInfo && (
        <g pointerEvents="none">
          <rect
            x={lockBadgePoint.x - 38}
            y={lockBadgePoint.y - 26}
            rx={8}
            ry={8}
            width={76}
            height={20}
            fill="hsl(var(--background))"
            stroke={strokeColor}
            strokeWidth={1}
          />
          <text
            x={lockBadgePoint.x}
            y={lockBadgePoint.y - 12}
            textAnchor="middle"
            fontSize="10"
            fill={strokeColor}
          >
            {lockInfo.name}
          </text>
        </g>
      )}

      <EdgeLabelRenderer>
        <>
          {showSegmentControls &&
            routeSegments.map((segment) => (
              <button
                key={`segment-${id}-${segment.segmentIndex}`}
                type="button"
                aria-label={t('erd.edge.segmentHandleAria', { index: segment.segmentIndex + 1 })}
                title={t('erd.edge.segmentHandleHint')}
                className={cn(
                  'nodrag nopan absolute flex items-center justify-center rounded-full border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  lockInfo
                    ? 'cursor-not-allowed opacity-60'
                    : segment.orientation === 'horizontal'
                      ? 'cursor-row-resize'
                      : 'cursor-col-resize',
                )}
                style={buildSegmentHandleStyle(segment.start, segment.end)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (lockInfo) {
                    return;
                  }
                  beginSegmentDrag({
                    edgeId: id,
                    pointerId: event.pointerId,
                    segmentIndex: segment.segmentIndex,
                    axis: segment.orientation === 'vertical' ? 'x' : 'y',
                    kind: 'segment',
                    routePoints,
                    waypoints: displayWaypoints,
                  });
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (lockInfo) {
                    return;
                  }
                  splitSegment({
                    edgeId: id,
                    segmentIndex: segment.segmentIndex,
                    routePoints,
                    clickPoint: reactFlowInstance.screenToFlowPosition({
                      x: event.clientX,
                      y: event.clientY,
                    }),
                  });
                }}
              >
                <span
                  className="block rounded-full border bg-background/90 shadow-sm"
                  style={{
                    width:
                      segment.orientation === 'horizontal'
                        ? SEGMENT_GRIP_LENGTH
                        : SEGMENT_GRIP_THICKNESS,
                    height:
                      segment.orientation === 'horizontal'
                        ? SEGMENT_GRIP_THICKNESS
                        : SEGMENT_GRIP_LENGTH,
                    borderColor: strokeColor,
                    boxShadow: '0 0 0 3px hsl(var(--background) / 0.92)',
                  }}
                />
              </button>
            ))}
        </>
      </EdgeLabelRenderer>
    </g>
  );
}
