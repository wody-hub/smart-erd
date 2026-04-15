/**
 * Theme foundation 모듈.
 *
 * ThemeName 계약, localStorage 파싱, dark-mode 파생, Monaco 매핑,
 * DOM class 적용 헬퍼를 한 곳에 정의한다.
 *
 * @module theme
 */

/** 지원하는 테마 이름 */
export type ThemeName = 'paper' | 'graphite' | 'midnight';

/** 기본 테마 (localStorage 값이 없거나 유효하지 않을 때 사용) */
export const DEFAULT_THEME: ThemeName = 'paper';

/** 유효한 테마 이름 집합 */
const VALID_THEMES: ReadonlySet<string> = new Set<ThemeName>(['paper', 'graphite', 'midnight']);

/** 테마별 CSS class 이름 */
const THEME_CLASSES: readonly string[] = [
  'theme-paper',
  'theme-graphite',
  'theme-midnight',
] as const;

/**
 * localStorage에 저장된 테마 문자열을 유효한 ThemeName으로 정규화한다.
 *
 * null, undefined, 빈 문자열, 알 수 없는 값이면 기본 테마(paper)를 반환한다.
 *
 * @param value localStorage에서 읽은 raw 문자열
 * @returns 정규화된 ThemeName
 */
export function resolveStoredTheme(value: string | null | undefined): ThemeName {
  if (value && VALID_THEMES.has(value)) {
    return value as ThemeName;
  }
  return DEFAULT_THEME;
}

/**
 * 테마가 dark 계열인지 판별한다.
 *
 * @param theme 판별 대상 테마
 * @returns paper이면 false, graphite/midnight이면 true
 */
export function isDarkTheme(theme: ThemeName): boolean {
  return theme !== 'paper';
}

/**
 * 테마에 대응하는 Monaco Editor 테마 이름을 반환한다.
 *
 * @param theme 현재 테마
 * @returns Monaco 테마 식별자 ('vs' | 'vs-dark')
 */
export function resolveMonacoTheme(theme: ThemeName): 'vs' | 'vs-dark' {
  return isDarkTheme(theme) ? 'vs-dark' : 'vs';
}

/**
 * DOM 요소에 테마 class를 적용한다.
 *
 * 기존 theme-* class를 모두 제거하고 현재 테마에 해당하는 class만 추가한다.
 * dark 테마(graphite, midnight)에서는 Tailwind dark: variant 호환성을 위해
 * .dark class를 함께 추가하고, light 테마(paper)에서는 제거한다.
 *
 * @param target class를 적용할 HTML 요소 (보통 document.documentElement)
 * @param theme  적용할 테마
 */
export function applyThemeClass(target: HTMLElement, theme: ThemeName): void {
  for (const cls of THEME_CLASSES) {
    target.classList.remove(cls);
  }
  target.classList.add(`theme-${theme}`);

  if (isDarkTheme(theme)) {
    target.classList.add('dark');
  } else {
    target.classList.remove('dark');
  }
}
