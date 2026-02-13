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
import { initServerUrl } from '@/lib/platform';
import './lib/monaco-setup';
import App from './App';

/**
 * 앱 부트스트랩. Electron 환경이면 서버 URL을 로드하여 캐시에 초기화한 후 React를 마운트한다.
 */
async function bootstrap() {
  const api = window.electronAPI;
  if (api) {
    const url = await api.getServerUrl();
    initServerUrl(url);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
