import type { IeChildMarker, IeParentMarker } from './erdIeMarkers';

/** 마커 선 굵기 */
const MARKER_STROKE_WIDTH = 1.5;
/** 옵션(o) 원 반지름 */
const CIRCLE_RADIUS = 3.5;
/** 까마귀발 벌어짐 (세로 반폭) */
const CROW_FOOT_SPREAD = 8;
/** 막대(|) 반길이 */
const BAR_HALF_LENGTH = 6;

/** IE 마커 공통 props */
interface IeEndMarkerProps {
  /** 핸들(테이블 경계) X 좌표 */
  x: number;
  /** 핸들(테이블 경계) Y 좌표 */
  y: number;
  /** 테이블 바깥쪽 방향 (-1: 왼쪽, 1: 오른쪽) */
  direction: number;
  /** 선/마커 색상 */
  stroke: string;
}

/**
 * 세로 막대(|)를 그린다.
 *
 * @param props.x      막대 X 좌표
 * @param props.y      막대 중심 Y 좌표
 * @param props.stroke 선 색상
 */
function Bar({ x, y, stroke }: { x: number; y: number; stroke: string }) {
  return (
    <line
      x1={x}
      y1={y - BAR_HALF_LENGTH}
      x2={x}
      y2={y + BAR_HALF_LENGTH}
      stroke={stroke}
      strokeWidth={MARKER_STROKE_WIDTH}
    />
  );
}

/**
 * 옵션 원(o)을 그린다. 배경색으로 채워 아래 관계선을 가린다.
 *
 * @param props.cx     원 중심 X 좌표
 * @param props.cy     원 중심 Y 좌표
 * @param props.stroke 선 색상
 */
function OptionalCircle({ cx, cy, stroke }: { cx: number; cy: number; stroke: string }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={CIRCLE_RADIUS}
      fill="hsl(var(--background))"
      stroke={stroke}
      strokeWidth={MARKER_STROKE_WIDTH}
    />
  );
}

/**
 * Erwin IE 표기의 부모 끝 마커를 그린다.
 *
 * 필수는 이중 막대(||), 선택은 막대 + 원(o|)이다.
 *
 * @param props.marker 부모 마커 종류
 */
export function IeParentEndMarker({
  x,
  y,
  direction,
  stroke,
  marker,
}: IeEndMarkerProps & { marker: IeParentMarker }) {
  if (marker === 'mandatory') {
    return (
      <g data-ie-marker="parent-mandatory">
        <Bar x={x + direction * 3} y={y} stroke={stroke} />
        <Bar x={x + direction * 7} y={y} stroke={stroke} />
      </g>
    );
  }
  return (
    <g data-ie-marker="parent-optional">
      <Bar x={x + direction * 3} y={y} stroke={stroke} />
      <OptionalCircle cx={x + direction * 9.5} cy={y} stroke={stroke} />
    </g>
  );
}

/**
 * Erwin IE 표기의 자식 끝 마커를 그린다.
 *
 * 0..N은 까마귀발 + 원(o<), 0..1은 막대 + 원(|o)이다.
 *
 * @param props.marker 자식 마커 종류
 */
export function IeChildEndMarker({
  x,
  y,
  direction,
  stroke,
  marker,
}: IeEndMarkerProps & { marker: IeChildMarker }) {
  if (marker === 'zero-or-many') {
    const tipX = x + direction * 10;
    return (
      <g data-ie-marker="child-zero-or-many">
        <line
          x1={x}
          y1={y - CROW_FOOT_SPREAD}
          x2={tipX}
          y2={y}
          stroke={stroke}
          strokeWidth={MARKER_STROKE_WIDTH}
        />
        <line x1={x} y1={y} x2={tipX} y2={y} stroke={stroke} strokeWidth={MARKER_STROKE_WIDTH} />
        <line
          x1={x}
          y1={y + CROW_FOOT_SPREAD}
          x2={tipX}
          y2={y}
          stroke={stroke}
          strokeWidth={MARKER_STROKE_WIDTH}
        />
        <OptionalCircle cx={x + direction * 13.5} cy={y} stroke={stroke} />
      </g>
    );
  }
  return (
    <g data-ie-marker="child-zero-or-one">
      <Bar x={x + direction * 3} y={y} stroke={stroke} />
      <OptionalCircle cx={x + direction * 9.5} cy={y} stroke={stroke} />
    </g>
  );
}
