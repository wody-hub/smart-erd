/**
 * 테마 상태 관리 Zustand 스토어.
 *
 * localStorage에 저장된 테마를 복원하고, setTheme 호출 시
 * localStorage + DOM class + state를 동기화한다.
 *
 * @module useThemeStore
 */
import { create } from 'zustand';
import { STORAGE_KEYS } from '@/constants/storage';
import { type ThemeName, resolveStoredTheme, isDarkTheme, applyThemeClass } from '@/lib/theme';

/** 테마 스토어 상태 인터페이스 */
interface ThemeState {
  /** 현재 활성 테마 */
  theme: ThemeName;
  /** 현재 테마가 dark 계열인지 여부 */
  isDark: boolean;
  /**
   * 테마를 변경한다.
   *
   * localStorage 저장, DOM class 적용, state 갱신을 동시에 수행한다.
   *
   * @param nextTheme 적용할 새 테마
   */
  setTheme: (nextTheme: ThemeName) => void;
}

/**
 * 테마 상태 관리 Zustand 스토어.
 *
 * 초기값은 localStorage에서 읽어 resolveStoredTheme으로 정규화한다.
 */
const useThemeStore = create<ThemeState>((set) => {
  const initial = resolveStoredTheme(localStorage.getItem(STORAGE_KEYS.THEME));

  return {
    theme: initial,
    isDark: isDarkTheme(initial),

    setTheme: (nextTheme: ThemeName) => {
      localStorage.setItem(STORAGE_KEYS.THEME, nextTheme);
      applyThemeClass(document.documentElement, nextTheme);
      set({ theme: nextTheme, isDark: isDarkTheme(nextTheme) });
    },
  };
});

export default useThemeStore;
