import type { TableHeaderColor } from '@/types/erd';

/** 색상 프리셋의 i18n 키 */
type ColorLabel =
  | 'erd.color.default'
  | 'erd.color.red'
  | 'erd.color.orange'
  | 'erd.color.amber'
  | 'erd.color.green'
  | 'erd.color.teal'
  | 'erd.color.blue'
  | 'erd.color.indigo'
  | 'erd.color.purple'
  | 'erd.color.pink';

/** 색상 프리셋 설정 */
export interface ColorConfig {
  /** i18n 번역 키 */
  label: ColorLabel;
  /** 배경색 CSS Variable (HSL 값) */
  bg: string;
  /** 전경색 CSS Variable (HSL 값) */
  fg: string;
}

/**
 * 테이블/그룹 헤더 색상 프리셋 상수.
 *
 * `default`는 기존 ERD 테이블 헤더 색상을 사용하며,
 * 나머지 9개는 `index.css`에 정의된 커스텀 CSS Variable을 참조한다.
 * 인라인 스타일로 `hsl(var(--token))` 형태로 사용한다.
 */
export const TABLE_COLORS: Record<TableHeaderColor, ColorConfig> = {
  default: {
    label: 'erd.color.default',
    bg: 'var(--erd-table-header)',
    fg: 'var(--erd-table-header-foreground)',
  },
  red: {
    label: 'erd.color.red',
    bg: 'var(--erd-color-red)',
    fg: 'var(--erd-color-red-foreground)',
  },
  orange: {
    label: 'erd.color.orange',
    bg: 'var(--erd-color-orange)',
    fg: 'var(--erd-color-orange-foreground)',
  },
  amber: {
    label: 'erd.color.amber',
    bg: 'var(--erd-color-amber)',
    fg: 'var(--erd-color-amber-foreground)',
  },
  green: {
    label: 'erd.color.green',
    bg: 'var(--erd-color-green)',
    fg: 'var(--erd-color-green-foreground)',
  },
  teal: {
    label: 'erd.color.teal',
    bg: 'var(--erd-color-teal)',
    fg: 'var(--erd-color-teal-foreground)',
  },
  blue: {
    label: 'erd.color.blue',
    bg: 'var(--erd-color-blue)',
    fg: 'var(--erd-color-blue-foreground)',
  },
  indigo: {
    label: 'erd.color.indigo',
    bg: 'var(--erd-color-indigo)',
    fg: 'var(--erd-color-indigo-foreground)',
  },
  purple: {
    label: 'erd.color.purple',
    bg: 'var(--erd-color-purple)',
    fg: 'var(--erd-color-purple-foreground)',
  },
  pink: {
    label: 'erd.color.pink',
    bg: 'var(--erd-color-pink)',
    fg: 'var(--erd-color-pink-foreground)',
  },
};

/** TABLE_COLORS의 entries 배열 (반복 렌더링용) */
export const TABLE_COLOR_ENTRIES = Object.entries(TABLE_COLORS) as [
  TableHeaderColor,
  ColorConfig,
][];
