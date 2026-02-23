import axios from 'axios';
import { create } from 'zustand';
import { STORAGE_KEYS } from '@/constants/storage';
import { clearAuthState } from '@/lib/auth-refresh';
import { getApiBaseUrl } from '@/lib/platform';

/**
 * 인증 상태를 관리하는 Zustand 스토어의 상태 인터페이스.
 */
interface AuthState {
  /** JWT Access Token (null이면 미인증) */
  accessToken: string | null;
  /** UUID Refresh Token */
  refreshToken: string | null;
  /** 사용자 로그인 ID */
  loginId: string | null;
  /** 사용자 표시 이름 */
  name: string | null;
  /**
   * 로그인 성공 시 상태를 갱신한다.
   *
   * @param accessToken  JWT Access Token
   * @param refreshToken UUID Refresh Token
   * @param loginId      사용자 로그인 ID
   * @param name         사용자 표시 이름
   */
  login: (accessToken: string, refreshToken: string, loginId: string, name: string) => void;
  /** 로그아웃 시 상태를 초기화한다 */
  logout: () => void;
}

/**
 * 인증 상태 관리 Zustand 스토어.
 *
 * localStorage에 저장된 토큰으로 초기 상태를 복원하고,
 * login/logout 시 localStorage와 동기화한다.
 */
const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  refreshToken: localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
  loginId: localStorage.getItem(STORAGE_KEYS.LOGIN_ID),
  name: localStorage.getItem(STORAGE_KEYS.NAME),

  login: (accessToken, refreshToken, loginId, name) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(STORAGE_KEYS.LOGIN_ID, loginId);
    localStorage.setItem(STORAGE_KEYS.NAME, name);
    set({ accessToken, refreshToken, loginId, name });
  },

  logout: () => {
    const rt = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (rt) {
      axios.post(`${getApiBaseUrl()}/auth/logout`, { refreshToken: rt }).catch(() => {});
    }
    clearAuthState();
  },
}));

export default useAuthStore;
