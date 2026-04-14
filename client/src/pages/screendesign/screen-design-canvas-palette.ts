import { isDarkTheme, type ThemeName } from '@/lib/theme';

export interface ScreenDesignCanvasPalette {
  frameFill: string;
  frameStroke: string;
  frameShadow: string;
  safeArea: string;
  canvasBackground: string;
  grid: string;
  surfaceFill: string;
  surfaceStroke: string;
  surfaceStrokeHex: string;
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary: string;
  accentQuaternary: string;
  accentInk: string;
  accentMuted: string;
  selection: string;
  orphan: string;
  anchorFill: string;
  shadowColor: string;
}

const SCREEN_DESIGN_CANVAS_TOKENS = {
  frameFill: '--screen-spec-frame-fill',
  frameStroke: '--screen-spec-frame-stroke',
  frameShadow: '--screen-spec-frame-shadow',
  safeArea: '--screen-spec-safe-area',
  canvasBackground: '--screen-spec-canvas-background',
  grid: '--screen-spec-grid',
  surfaceFill: '--screen-spec-surface-fill',
  surfaceStroke: '--screen-spec-surface-stroke',
  accentPrimary: '--screen-spec-accent-primary',
  accentSecondary: '--screen-spec-accent-secondary',
  accentTertiary: '--screen-spec-accent-tertiary',
  accentQuaternary: '--screen-spec-accent-quaternary',
  accentInk: '--screen-spec-accent-ink',
  accentMuted: '--screen-spec-accent-muted',
  selection: '--screen-spec-selection',
  orphan: '--screen-spec-orphan',
  anchorFill: '--screen-spec-anchor-fill',
  shadowColor: '--screen-spec-shadow-color',
} as const;

/**
 * 현재 테마의 screen-spec canvas 색상 토큰을 Konva용 color string으로 해석한다.
 *
 * @param theme 현재 활성 테마. fallback token을 선택하고 theme 변경 시 palette 재해석을 트리거한다.
 * @param root CSS variable을 읽을 기준 요소
 * @returns canvas 렌더링에 사용할 팔레트
 */
export function resolveScreenDesignCanvasPalette(
  theme: ThemeName,
  root: HTMLElement = document.documentElement,
): ScreenDesignCanvasPalette {
  const styles = getComputedStyle(root);
  const surfaceStroke = readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.surfaceStroke, '--border');
  const frameShadowFallback = isDarkTheme(theme) ? '--surface-strong' : '--secondary';
  const shadowColorFallback = isDarkTheme(theme) ? '--muted-foreground' : '--foreground';

  return {
    frameFill: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.frameFill, '--card'),
    frameStroke: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.frameStroke, '--border'),
    frameShadow: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.frameShadow, frameShadowFallback),
    safeArea: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.safeArea, '--border'),
    canvasBackground: readHslToken(
      styles,
      SCREEN_DESIGN_CANVAS_TOKENS.canvasBackground,
      '--background',
    ),
    grid: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.grid, '--border'),
    surfaceFill: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.surfaceFill, '--card'),
    surfaceStroke,
    surfaceStrokeHex: convertCssColorToHex(surfaceStroke),
    accentPrimary: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.accentPrimary, '--secondary'),
    accentSecondary: readHslToken(
      styles,
      SCREEN_DESIGN_CANVAS_TOKENS.accentSecondary,
      '--secondary',
    ),
    accentTertiary: readHslToken(
      styles,
      SCREEN_DESIGN_CANVAS_TOKENS.accentTertiary,
      '--surface-strong',
    ),
    accentQuaternary: readHslToken(
      styles,
      SCREEN_DESIGN_CANVAS_TOKENS.accentQuaternary,
      '--surface-muted',
    ),
    accentInk: readHslToken(
      styles,
      SCREEN_DESIGN_CANVAS_TOKENS.accentInk,
      '--foreground-secondary',
    ),
    accentMuted: readHslToken(
      styles,
      SCREEN_DESIGN_CANVAS_TOKENS.accentMuted,
      '--muted-foreground',
    ),
    selection: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.selection, '--primary'),
    orphan: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.orphan, '--erd-warning'),
    anchorFill: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.anchorFill, '--card'),
    shadowColor: readHslToken(styles, SCREEN_DESIGN_CANVAS_TOKENS.shadowColor, shadowColorFallback),
  };
}

/**
 * custom property에 저장된 HSL token을 `hsl(...)` 문자열로 변환한다.
 *
 * @param styles CSS declaration 집합
 * @param tokenName 우선 조회할 custom property 이름
 * @param fallbackTokenName 값이 없을 때 사용할 fallback token 이름
 * @returns Konva/canvas에서 바로 사용할 수 있는 color string
 */
function readHslToken(
  styles: CSSStyleDeclaration,
  tokenName: string,
  fallbackTokenName: string,
): string {
  const token =
    styles.getPropertyValue(tokenName).trim() ||
    styles.getPropertyValue(fallbackTokenName).trim() ||
    '0 0% 0%';
  return `hsl(${token})`;
}

/**
 * 브라우저가 해석한 CSS color 문자열을 color input용 hex 포맷으로 변환한다.
 *
 * @param color 변환 대상 CSS color 문자열
 * @returns `#rrggbb` 형태의 문자열
 */
export function convertCssColorToHex(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  probe.style.display = 'none';
  document.body.appendChild(probe);

  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);

  const match = resolved.match(/\d+/g);
  if (!match || match.length < 3) {
    return '#000000';
  }

  return `#${match
    .slice(0, 3)
    .map((value) => Number.parseInt(value, 10).toString(16).padStart(2, '0'))
    .join('')}`;
}
