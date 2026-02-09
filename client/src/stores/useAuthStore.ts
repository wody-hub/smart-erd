import axios from 'axios';
import { create } from 'zustand';

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
  /** 인증 여부 */
  isAuthenticated: boolean;
  /** 로그인 성공 시 상태를 갱신한다 */
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
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  loginId: localStorage.getItem('loginId'),
  name: localStorage.getItem('name'),
  isAuthenticated: !!localStorage.getItem('accessToken'),

  login: (accessToken, refreshToken, loginId, name) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('loginId', loginId);
    localStorage.setItem('name', name);
    set({ accessToken, refreshToken, loginId, name, isAuthenticated: true });
  },

  logout: () => {
    const rt = localStorage.getItem('refreshToken');
    if (rt) {
      axios.post('/api/auth/logout', { refreshToken: rt }).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('loginId');
    localStorage.removeItem('name');
    set({
      accessToken: null,
      refreshToken: null,
      loginId: null,
      name: null,
      isAuthenticated: false,
    });
  },
}));

export default useAuthStore;
