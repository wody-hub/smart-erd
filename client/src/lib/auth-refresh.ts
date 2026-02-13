import axios from 'axios';
import { STORAGE_KEYS } from '@/constants/storage';
import useAuthStore from '@/stores/useAuthStore';
import { getApiBaseUrl } from '@/lib/platform';

/**
 * 동시에 발생한 refresh 요청을 단일 실행으로 합치기 위한 in-flight Promise.
 * 모듈 스코프 — Promise를 Zustand에 저장하면 직렬화 불가 + 셀렉터 안정성 문제로 모듈 스코프에 유지.
 */
let refreshInFlight: Promise<string> | null = null;

/**
 * 인증 토큰을 localStorage와 Zustand 스토어에 동기화한다.
 *
 * @param accessToken  새 Access Token
 * @param refreshToken 새 Refresh Token
 */
function setAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  useAuthStore.setState((prev) => ({
    ...prev,
    accessToken,
    refreshToken,
    isAuthenticated: true,
  }));
}

/**
 * 인증 상태를 초기화한다.
 */
export function clearAuthState(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.LOGIN_ID);
  localStorage.removeItem(STORAGE_KEYS.NAME);
  useAuthStore.setState((prev) => ({
    ...prev,
    accessToken: null,
    refreshToken: null,
    loginId: null,
    name: null,
    isAuthenticated: false,
  }));
}

/**
 * JWT payload에서 exp(epoch seconds)를 추출한다.
 *
 * @param token JWT 문자열
 * @returns exp 값. 파싱 실패 시 null
 */
function getJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof payload.exp !== 'number') {
      return null;
    }
    return payload.exp;
  } catch {
    return null;
  }
}

/**
 * JWT 만료 여부를 확인한다.
 *
 * @param token JWT 문자열
 * @returns 만료 여부
 */
function isJwtExpired(token: string): boolean {
  const exp = getJwtExp(token);
  if (exp === null) {
    return true;
  }
  const nowEpochSec = Math.floor(Date.now() / 1000);
  return exp <= nowEpochSec + 5;
}

/**
 * Refresh Token으로 Access Token을 갱신한다.
 *
 * 여러 호출이 동시에 들어오면 단일 HTTP 요청만 수행한다.
 *
 * @returns 갱신된 Access Token
 */
export async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const res = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${getApiBaseUrl()}/auth/refresh`,
      {
        refreshToken,
      },
    );
    const newAccessToken = res.data.accessToken;
    const newRefreshToken = res.data.refreshToken;
    setAuthTokens(newAccessToken, newRefreshToken);
    return newAccessToken;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/**
 * WebSocket/HTTP 요청에 사용할 유효한 Access Token을 반환한다.
 *
 * @param fallbackToken localStorage에 없을 때 사용할 후보 토큰
 * @returns 사용 가능한 Access Token. 확보 실패 시 null
 */
export async function resolveUsableAccessToken(fallbackToken?: string): Promise<string | null> {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ?? fallbackToken;
  if (!token) {
    return null;
  }

  if (!isJwtExpired(token)) {
    return token;
  }

  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
}
