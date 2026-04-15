/**
 * 애플리케이션 진입점.
 *
 * Electron 환경에서는 서버 URL을 비동기로 로드한 후,
 * React 19 `createRoot` API를 사용하여 `#root` DOM 요소에
 * {@link App} 컴포넌트를 StrictMode로 마운트한다.
 *
 * @module main
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import { isElectron, initServerUrl } from '@/lib/platform';
import { STORAGE_KEYS } from '@/constants/storage';
import { resolveStoredTheme, applyThemeClass } from '@/lib/theme';
import App from './App';

/**
 * 앱 부트스트랩. Electron 환경이면 서버 URL을 로드하여 캐시에 초기화한 후 React를 마운트한다.
 * electronAPI가 없는 경우 localStorage를 fallback으로 사용한다.
 *
 * @returns React 앱 마운트 완료 Promise
 */
async function bootstrap() {
  // Theme bootstrap: React mount 전에 class를 적용하여 flash를 방지한다
  if (document.documentElement) {
    const initialTheme = resolveStoredTheme(localStorage.getItem(STORAGE_KEYS.THEME));
    applyThemeClass(document.documentElement, initialTheme);
  }

  if (isElectron()) {
    const api = window.electronAPI;
    if (api) {
      const url = await api.getServerUrl();
      initServerUrl(url);
    } else {
      const url = localStorage.getItem(STORAGE_KEYS.SERVER_URL) ?? '';
      initServerUrl(url);
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
