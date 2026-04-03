import { create } from "zustand";
import type { ThemeName } from "@/lib/theme";
import {
  resolveStoredTheme,
  isDarkTheme,
  applyThemeClass,
} from "@/lib/theme";
import { STORAGE_KEYS } from "@/constants/storage";

/** Theme 스토어 상태 인터페이스 */
interface ThemeState {
  /** 현재 선택된 theme */
  theme: ThemeName;
  /** 현재 theme이 dark 계열인지 여부 */
  isDark: boolean;
  /**
   * theme을 변경한다. localStorage 저장 + DOM class 적용 + state 갱신을 동시에 수행한다.
   *
   * @param next 변경할 ThemeName
   */
  setTheme: (next: ThemeName) => void;
}

/** 초기 theme: localStorage 저장값을 resolveStoredTheme으로 정규화 */
const initialTheme = resolveStoredTheme(
  localStorage.getItem(STORAGE_KEYS.THEME),
);

/**
 * Theme 상태를 관리하는 Zustand 스토어.
 *
 * localStorage persistence + DOM class 동기화를 setTheme 액션에서 일괄 처리한다.
 */
const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  isDark: isDarkTheme(initialTheme),
  setTheme: (next: ThemeName) => {
    localStorage.setItem(STORAGE_KEYS.THEME, next);
    applyThemeClass(document.documentElement, next);
    set({ theme: next, isDark: isDarkTheme(next) });
  },
}));

export default useThemeStore;
