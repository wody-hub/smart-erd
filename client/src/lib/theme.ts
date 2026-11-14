/**
 * Theme foundation 모듈.
 *
 * ThemeName 계약, localStorage 파싱, dark-mode 파생, Monaco 매핑,
 * DOM class 적용 헬퍼를 한 곳에 정의한다.
 *
 * @module theme
 */

/** 지원하는 테마 이름 */
export type ThemeName = 'paper' | 'graphite' | 'midnight' | 'lumen' | 'eclipse';

/** 테마 선택 UI에 표시되는 순서 (스위처, 로그인 화면 공용) */
export const THEME_OPTIONS: readonly ThemeName[] = [
  'paper',
  'graphite',
  'midnight',
  'lumen',
  'eclipse',
] as const;

/** dark 계열 테마 집합 (.dark class 및 Monaco vs-dark 적용 대상) */
const DARK_THEMES: ReadonlySet<ThemeName> = new Set<ThemeName>(['graphite', 'midnight', 'eclipse']);

/** 기본 테마 (localStorage 값이 없거나 유효하지 않을 때 사용). 저장된 테마가 있는 사용자는 영향받지 않는다. */
export const DEFAULT_THEME: ThemeName = 'lumen';

/** 유효한 테마 이름 집합 */
const VALID_THEMES: ReadonlySet<string> = new Set<ThemeName>(THEME_OPTIONS);

/** 테마별 CSS class 이름 */
const THEME_CLASSES: readonly string[] = [
  'theme-paper',
  'theme-graphite',
  'theme-midnight',
  'theme-lumen',
  'theme-eclipse',
] as const;
// 주의: 클래스명을 템플릿(`theme-${name}`)으로 조합하지 말 것.
// Tailwind가 콘텐츠 스캔에서 리터럴을 찾지 못하면 index.css @layer base의 .theme-* 규칙을 제거한다.

/**
 * ERD 테이블 카드/관계선 스타일 변형.
 *
 * - `classic`: 기존 모양 (paper, graphite, midnight, eclipse)
 * - `ie`: Erwin IE 표기 기반 모양 (단색 헤더, PK 블록 구분, 부모 필수/선택 마커)
 */
export type ErdCardVariant = 'classic' | 'ie';

/** 테마별 ERD 카드 변형. 다른 테마에 확장할 때는 이 매핑만 바꾼다. */
const ERD_CARD_VARIANTS: Readonly<Record<ThemeName, ErdCardVariant>> = {
  paper: 'classic',
  graphite: 'classic',
  midnight: 'classic',
  lumen: 'ie',
  eclipse: 'classic',
};

/**
 * 테마에 대응하는 ERD 카드 변형을 반환한다.
 *
 * @param theme 현재 테마
 * @returns ERD 카드 변형 ('classic' | 'ie')
 */
export function resolveErdCardVariant(theme: ThemeName): ErdCardVariant {
  return ERD_CARD_VARIANTS[theme];
}

/**
 * localStorage에 저장된 테마 문자열을 유효한 ThemeName으로 정규화한다.
 *
 * null, undefined, 빈 문자열, 알 수 없는 값이면 기본 테마(lumen)를 반환한다.
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
 * @returns graphite/midnight/eclipse이면 true, paper/lumen이면 false
 */
export function isDarkTheme(theme: ThemeName): boolean {
  return DARK_THEMES.has(theme);
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
 * dark 테마(graphite, midnight, eclipse)에서는 Tailwind dark: variant 호환성을 위해
 * .dark class를 함께 추가하고, light 테마(paper, lumen)에서는 제거한다.
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
