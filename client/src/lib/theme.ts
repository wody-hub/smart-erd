/**
 * Theme 계약 정의 및 pure helper 함수.
 *
 * 3개의 curated theme(paper, graphite, midnight)을 관리하는 단일 모듈이다.
 * DOM class 적용, Monaco 매핑, localStorage 정규화 등 theme 관련 판정 기준을 한 곳에서 관리한다.
 */

/** 지원하는 curated theme 이름 */
export type ThemeName = "paper" | "graphite" | "midnight";

/** 기본 theme */
export const DEFAULT_THEME: ThemeName = "paper";

/** theme class prefix */
const THEME_CLASS_PREFIX = "theme-";

/** 유효한 theme 이름 집합 */
const VALID_THEMES = new Set<string>(["paper", "graphite", "midnight"]);

/**
 * localStorage 등에서 읽은 값을 유효한 ThemeName으로 정규화한다.
 *
 * @param value 저장된 theme 문자열 (null/undefined/빈 문자열 가능)
 * @returns 유효한 ThemeName. 유효하지 않으면 DEFAULT_THEME 반환
 */
export function resolveStoredTheme(
  value: string | null | undefined,
): ThemeName {
  if (value && VALID_THEMES.has(value)) {
    return value as ThemeName;
  }
  return DEFAULT_THEME;
}

/**
 * 해당 theme이 dark 계열인지 판정한다.
 *
 * @param theme 판정 대상 ThemeName
 * @returns graphite, midnight이면 true, paper이면 false
 */
export function isDarkTheme(theme: ThemeName): boolean {
  return theme !== "paper";
}

/**
 * theme에 대응하는 Monaco Editor theme을 반환한다.
 *
 * @param theme 현재 ThemeName
 * @returns Monaco 'vs' (light) 또는 'vs-dark'
 */
export function resolveMonacoTheme(theme: ThemeName): "vs" | "vs-dark" {
  return isDarkTheme(theme) ? "vs-dark" : "vs";
}

/**
 * 대상 HTML element에 theme class를 적용한다.
 *
 * theme-paper, theme-graphite, theme-midnight 중 현재 theme만 남기고 나머지는 제거한다.
 * dark 계열 theme에서는 .dark class도 추가하고, light에서는 제거한다.
 * .dark는 Tailwind dark: variant 호환성 bit로만 취급한다.
 *
 * @param target class를 적용할 HTMLElement
 * @param theme 적용할 ThemeName
 */
export function applyThemeClass(target: HTMLElement, theme: ThemeName): void {
  for (const t of VALID_THEMES) {
    target.classList.remove(`${THEME_CLASS_PREFIX}${t}`);
  }
  target.classList.add(`${THEME_CLASS_PREFIX}${theme}`);

  if (isDarkTheme(theme)) {
    target.classList.add("dark");
  } else {
    target.classList.remove("dark");
  }
}
