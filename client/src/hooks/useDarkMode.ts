import useThemeStore from '@/stores/useThemeStore';

/**
 * 다크 모드 상태를 반환하는 호환성 어댑터 훅.
 *
 * 기존 MutationObserver 기반 감지를 useThemeStore 기반으로 대체한다.
 * Graphite/Midnight에서 true, Paper에서 false를 반환한다.
 *
 * @returns 다크 모드 활성화 여부
 */
export function useDarkMode(): boolean {
  return useThemeStore((state) => state.isDark);
}
