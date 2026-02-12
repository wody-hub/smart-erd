import {
  type EdgeProps,
  getSmoothStepPath,
  useStore,
  BaseEdge,
  type Position,
} from '@xyflow/react';
import type { TableNodeData, RelationType } from '@/types/erd';
import { extractColId } from '@/stores/useCanvasStore';

/** 카디널리티 기호 유형 */
type CardinalitySymbol = 'one' | 'many';

/** 카디널리티 계산 결과 */
interface Cardinality {
  /** 부모 쪽 기호 */
  sourceSymbol: CardinalitySymbol;
  /** 자식 쪽 기호 */
  targetSymbol: CardinalitySymbol;
  /** FK nullable 여부 (optional = 원, mandatory = 직선) */
  optional: boolean;
}

/**
 * 엣지의 카디널리티를 자동 판단한다.
 *
 * @param relationType 관계 유형
 * @param targetNodeId 자식 노드 ID
 * @param targetHandle 자식 Handle ID
 * @param nodes        전체 노드 배열
 * @returns 카디널리티 정보
 */
function computeCardinality(
  relationType: RelationType,
  targetNodeId: string,
  targetHandle: string | null | undefined,
  nodes: { id: string; data: unknown }[],
): Cardinality {
  const childNode = nodes.find((n) => n.id === targetNodeId);
  const sourceSymbol: CardinalitySymbol = 'one';

  let targetSymbol: CardinalitySymbol = 'many';
  let optional = true;

  if (childNode?.data) {
    const childData = childNode.data as TableNodeData;

    if (targetHandle) {
      const colId = extractColId(targetHandle, targetNodeId);
      const fkCol = childData.columns.find((c) => c.id === colId);
      optional = fkCol?.nullable !== false;
    }

    if (relationType === 'identifying') {
      const pkCols = childData.columns.filter((c) => c.pk);
      const fkPkCols = pkCols.filter((c) => c.fk);
      // FK가 자식 PK 전체를 구성하면 1:1, 아니면 1:N
      targetSymbol = fkPkCols.length > 0 && fkPkCols.length === pkCols.length ? 'one' : 'many';
    }
  }

  return { sourceSymbol, targetSymbol, optional };
}

/** 마커 영역 오프셋 — 엣지 경로를 단축하여 마커를 그릴 공간 확보 (px) */
const MARKER_OFFSET = 20;
/** Crow's foot 갈래의 수직 퍼짐 크기 (px) */
const CROW_FOOT_SPREAD = 8;

/**
 * 부모 쪽 "One" 마커 (|| 두 수직선)를 렌더링한다.
 *
 * @param x         기준 X 좌표
 * @param y         기준 Y 좌표
 * @param direction 방향 (1 = 오른쪽, -1 = 왼쪽)
 * @param stroke    선 색상
 */
function renderOneMarker(x: number, y: number, direction: number, stroke: string) {
  const x1 = x + direction * 6;
  const x2 = x + direction * 10;
  return (
    <g>
      <line x1={x1} y1={y - 6} x2={x1} y2={y + 6} stroke={stroke} strokeWidth={1.5} />
      <line x1={x2} y1={y - 6} x2={x2} y2={y + 6} stroke={stroke} strokeWidth={1.5} />
    </g>
  );
}

/**
 * 자식 쪽 카디널리티 마커를 렌더링한다.
 *
 * @param x         기준 X 좌표
 * @param y         기준 Y 좌표
 * @param direction 방향 (1 = 오른쪽으로 향함, -1 = 왼쪽으로 향함)
 * @param symbol    카디널리티 기호 (one / many)
 * @param optional  선택 여부 (true = 원, false = 직선)
 * @param stroke    선 색상
 */
function renderTargetMarker(
  x: number,
  y: number,
  direction: number,
  symbol: CardinalitySymbol,
  optional: boolean,
  stroke: string,
) {
  const elements: React.ReactNode[] = [];

  // Optionality 표시 (바깥쪽)
  const optX = x - direction * (MARKER_OFFSET - 2);
  if (optional) {
    // 원 (○)
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
  } else {
    // 수직선 (|) — mandatory
    elements.push(
      <line
        key="opt"
        x1={optX}
        y1={y - 6}
        x2={optX}
        y2={y + 6}
        stroke={stroke}
        strokeWidth={1.5}
      />,
    );
  }

  if (symbol === 'many') {
    // Crow's foot (<) — 세 갈래
    const tipX = x;
    const baseX = x - direction * 12;
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
    // One (|) — 수직선
    const lineX = x - direction * 8;
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

/**
 * Crow's Foot 표기법 커스텀 엣지 컴포넌트.
 *
 * 식별 관계는 실선, 비식별 관계는 점선으로 렌더링하며,
 * 양 끝에 카디널리티 마커(||, <, ○ 등)를 SVG로 그린다.
 */
export default function ErdRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  target,
  targetHandleId,
  style,
  selected,
}: EdgeProps) {
  const nodes = useStore((s) => s.nodes);
  const relationType: RelationType =
    (data as { relationType?: RelationType } | undefined)?.relationType ?? 'non-identifying';

  const { sourceSymbol, targetSymbol, optional } = computeCardinality(
    relationType,
    target,
    targetHandleId,
    nodes,
  );

  // sourceDirection: source에서 바깥쪽 방향
  const sourceDirection = sourcePosition === ('left' as Position) ? -1 : 1;
  // targetDirection: target에서 바깥쪽 방향
  const targetDirection = targetPosition === ('left' as Position) ? -1 : 1;

  // 마커 공간만큼 offset을 적용하여 경로 단축
  const adjustedSourceX = sourceX + sourceDirection * MARKER_OFFSET;
  const adjustedTargetX = targetX + targetDirection * MARKER_OFFSET;

  const [edgePath] = getSmoothStepPath({
    sourceX: adjustedSourceX,
    sourceY,
    targetX: adjustedTargetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const edgeStyle = style as React.CSSProperties | undefined;
  const strokeColor =
    (edgeStyle?.stroke as string) ??
    (selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))');
  const strokeWidth = selected ? 2.5 : 1.5;

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

      {/* 부모 쪽 마커 (||) */}
      {sourceSymbol === 'one' && renderOneMarker(sourceX, sourceY, sourceDirection, strokeColor)}

      {/* 자식 쪽 마커 */}
      {renderTargetMarker(targetX, targetY, targetDirection, targetSymbol, optional, strokeColor)}

      {/* 투명한 넓은 히트영역 (클릭/선택용) */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />
    </g>
  );
}
