import type { TableHeaderColor } from '@/types/erd';

/** 색상 프리셋의 i18n 키 */
type ColorLabel =
  | 'erd.color.default'
  | 'erd.color.supporting'
  | 'erd.color.attention';

/** 현재 디자인 시스템에서 실제로 노출하는 헤더 색상 프리셋 */
export type CanonicalTableHeaderColor = 'default' | 'supporting' | 'attention';

/** 색상 프리셋 설정 */
export interface ColorConfig {
  /** i18n 번역 키 */
  label: ColorLabel;
  /** 배경색 CSS Variable (HSL 값) */
  bg: string;
  /** 전경색 CSS Variable (HSL 값) */
  fg: string;
}

const CANONICAL_TABLE_COLOR_ORDER: CanonicalTableHeaderColor[] = [
  'default',
  'supporting',
  'attention',
];

const LEGACY_TABLE_COLOR_MAP: Record<
  Exclude<TableHeaderColor, CanonicalTableHeaderColor>,
  CanonicalTableHeaderColor
> = {
  red: 'attention',
  orange: 'attention',
  amber: 'attention',
  green: 'supporting',
  teal: 'supporting',
  blue: 'default',
  indigo: 'default',
  purple: 'default',
  pink: 'attention',
};

/**
 * 저장된 테이블 헤더 색상을 현재 디자인 시스템의 canonical preset으로 정규화한다.
 */
export function normalizeTableHeaderColor(
  color?: TableHeaderColor | null,
): CanonicalTableHeaderColor {
  if (!color || color === 'default' || color === 'supporting' || color === 'attention') {
    return color ?? 'default';
  }
  return LEGACY_TABLE_COLOR_MAP[color];
}

const CANONICAL_TABLE_COLORS: Record<CanonicalTableHeaderColor, ColorConfig> = {
  default: {
    label: 'erd.color.default',
    bg: 'var(--erd-table-header)',
    fg: 'var(--erd-table-header-foreground)',
  },
  supporting: {
    label: 'erd.color.supporting',
    bg: 'var(--erd-table-supporting)',
    fg: 'var(--erd-table-supporting-foreground)',
  },
  attention: {
    label: 'erd.color.attention',
    bg: 'var(--erd-table-attention)',
    fg: 'var(--erd-table-attention-foreground)',
  },
};

/**
 * 테이블/그룹 헤더 색상 프리셋 상수.
 *
 * 새 UI에서는 3개 semantic preset만 노출하고,
 * legacy 색상 키는 기존 문서 호환을 위해 canonical preset으로 매핑한다.
 */
export const TABLE_COLORS: Record<TableHeaderColor, ColorConfig> = {
  default: CANONICAL_TABLE_COLORS.default,
  supporting: CANONICAL_TABLE_COLORS.supporting,
  attention: CANONICAL_TABLE_COLORS.attention,
  red: CANONICAL_TABLE_COLORS.attention,
  orange: CANONICAL_TABLE_COLORS.attention,
  amber: CANONICAL_TABLE_COLORS.attention,
  green: CANONICAL_TABLE_COLORS.supporting,
  teal: CANONICAL_TABLE_COLORS.supporting,
  blue: CANONICAL_TABLE_COLORS.default,
  indigo: CANONICAL_TABLE_COLORS.default,
  purple: CANONICAL_TABLE_COLORS.default,
  pink: CANONICAL_TABLE_COLORS.attention,
};

/** 실제 UI에서 노출할 color picker 엔트리 배열 */
export const TABLE_COLOR_PICKER_ENTRIES = CANONICAL_TABLE_COLOR_ORDER.map((key) => [
  key,
  CANONICAL_TABLE_COLORS[key],
]) as [
  CanonicalTableHeaderColor,
  ColorConfig,
][];
