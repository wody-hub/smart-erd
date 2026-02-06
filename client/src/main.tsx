/**
 * 애플리케이션 진입점.
 *
 * React 18 `createRoot` API를 사용하여 `#root` DOM 요소에
 * {@link App} 컴포넌트를 StrictMode로 마운트한다.
 *
 * @module main
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
