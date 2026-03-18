/** 테이블 헤더 zoom 보정 debounce 지연 (ms) */
export const TABLE_HEADER_ZOOM_COMPENSATION_DELAY_MS = 160;
/** zoom 보정 재적용을 생략할 최소 변화량 */
export const TABLE_HEADER_ZOOM_CHANGE_EPSILON = 0.01;

/**
 * 현재 zoom에 따라 테이블 헤더 폰트 크기 토큰을 계산한다.
 *
 * 확대/축소 중 개별 노드를 리렌더하지 않도록, 캔버스 루트 CSS 변수로만 전달할 값을 만든다.
 *
 * @param zoom 현재 React Flow zoom 배율
 * @returns 논리명/물리명 폰트 크기와 line-height 토큰
 */
export function resolveHeaderFontSizeTokens(zoom: number): {
  logicalFontSize: string;
  logicalLineHeight: string;
  physicalFontSize: string;
  physicalLineHeight: string;
} {
  const clampedZoom = Math.max(0.35, Math.min(zoom, 1));
  const compensation = clampedZoom >= 0.85 ? 1 : Math.min(1.8, 0.85 / clampedZoom);
  const logical = Math.round(12 * compensation);
  const physical = Math.round(16 * compensation);

  return {
    logicalFontSize: `${logical}px`,
    logicalLineHeight: `${logical + 2}px`,
    physicalFontSize: `${physical}px`,
    physicalLineHeight: `${physical + 4}px`,
  };
}

/**
 * 캔버스 루트에 테이블 헤더 폰트 보정 CSS 변수를 적용한다.
 *
 * @param container CSS 변수를 적용할 캔버스 루트 요소
 * @param zoom 현재 React Flow zoom 배율
 * @returns 없음
 */
export function applyHeaderZoomCssVariables(container: HTMLDivElement | null, zoom: number): void {
  if (!container) {
    return;
  }

  const tokens = resolveHeaderFontSizeTokens(zoom);
  container.style.setProperty('--erd-table-header-logical-font-size', tokens.logicalFontSize);
  container.style.setProperty('--erd-table-header-logical-line-height', tokens.logicalLineHeight);
  container.style.setProperty('--erd-table-header-physical-font-size', tokens.physicalFontSize);
  container.style.setProperty('--erd-table-header-physical-line-height', tokens.physicalLineHeight);
}
