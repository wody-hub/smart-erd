import { ROUTES } from '@/constants/routes';

/** 모듈 스코프 캐시 — bootstrap() 완료 후에만 유효한 값을 가진다 */
let cachedServerUrl = '';

/**
 * Electron 데스크톱 환경인지 확인한다.
 *
 * preload의 contextBridge(window.electronAPI)를 우선 확인하고,
 * fallback으로 User-Agent에 "Electron" 포함 여부를 검사한다.
 *
 * @returns Electron 환경이면 true, 웹 환경이면 false
 */
export function isElectron(): boolean {
  return (
    window.electronAPI?.isElectron === true ||
    navigator.userAgent.toLowerCase().includes('electron')
  );
}

/**
 * 서버 URL을 캐시에 저장한다. main.tsx의 bootstrap()에서 1회 호출.
 *
 * @param url 서버 URL (예: 'http://localhost:9503')
 */
export function initServerUrl(url: string): void {
  cachedServerUrl = url;
}

/**
 * 서버 URL 변경 시 호출 — 캐시 갱신 + 앱 상태 전면 초기화.
 *
 * 서버가 바뀌면 기존 인증 토큰, React Query 캐시가 모두 무효하므로
 * 이전 서버에 logout을 best-effort로 시도한 후,
 * 전체 상태를 초기화하고 로그인 페이지로 이동한다.
 *
 * @param url       새 서버 URL
 * @param deps      앱 상태 초기화에 필요한 콜백
 * @param deps.clearCache  React Query 캐시 전면 삭제 (queryClient.clear)
 * @param deps.clearAuth   인증 상태 초기화 (localStorage 토큰 + Zustand 상태)
 * @param deps.logoutFromServer  이전 서버에 logout API 호출 (실패 시 무시)
 */
export async function updateServerUrl(
  url: string,
  deps: {
    clearCache: () => void;
    clearAuth: () => void;
    logoutFromServer: () => Promise<void>;
  },
): Promise<void> {
  // 이전 서버에 logout 시도 (Refresh Token 폐기). 네트워크 실패 시 무시.
  await deps.logoutFromServer().catch(() => {});

  const api = window.electronAPI;
  if (api) {
    await api.setServerUrl(url);
  } else {
    localStorage.setItem('smart-erd-server-url', url);
  }
  cachedServerUrl = url;
  deps.clearCache();
  deps.clearAuth();
  // App 컴포넌트의 needsServerSetup 재평가를 위해 전체 리로드.
  // bootstrap()이 electron-store / localStorage에서 URL을 다시 로드한다.
  // HashRouter 사용 시 hash를 루트로 변경해야 Settings 라우트에 재진입하지 않는다.
  if (isElectron()) {
    window.location.hash = '#/';
  }
  window.location.reload();
}

/**
 * API base URL을 반환한다.
 *
 * @returns Web: '/api', Electron: '{serverUrl}/api'
 */
export function getApiBaseUrl(): string {
  if (!isElectron()) return '/api';
  if (!cachedServerUrl) {
    throw new Error('Server URL not initialized. Call initServerUrl() first.');
  }
  return `${cachedServerUrl}/api`;
}

/**
 * WebSocket base URL을 반환한다.
 *
 * @returns Web: window.location 기반 ws/wss URL, Electron: 캐시 URL 기반
 */
export function getWsBaseUrl(): string {
  if (!isElectron()) {
    const directWsBaseUrl = import.meta.env.VITE_WS_DIRECT_BASE_URL;
    if (directWsBaseUrl) {
      return directWsBaseUrl.replace(/\/$/, '');
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  if (!cachedServerUrl) {
    throw new Error('Server URL not initialized. Call initServerUrl() first.');
  }
  const url = new URL(cachedServerUrl);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${url.host}`;
}

/**
 * 로그인 페이지로 리다이렉트한다.
 * Electron(HashRouter)과 Web(BrowserRouter) 분기를 내부에서 처리한다.
 */
export function redirectToLogin(): void {
  if (isElectron()) {
    window.location.hash = `#${ROUTES.LOGIN}`;
  } else {
    window.location.href = ROUTES.LOGIN;
  }
}

/**
 * 캐시된 서버 URL을 반환한다 (읽기 전용).
 *
 * @returns 현재 캐시된 서버 URL
 */
export function getServerUrl(): string {
  return cachedServerUrl;
}
