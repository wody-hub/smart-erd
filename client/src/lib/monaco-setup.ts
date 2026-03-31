/**
 * Monaco Editor 로컬 번들 설정.
 *
 * Electron 환경에서는 CDN에 접근할 수 없으므로
 * 로컬에 설치된 monaco-editor 패키지를 직접 사용하도록 설정한다.
 * 웹 환경에서는 기본 CDN 로더를 그대로 사용한다.
 *
 * Monaco Editor를 실제로 렌더하는 컴포넌트에서 side-effect import로 불러온다.
 *
 * @module monaco-setup
 */
import { loader } from '@monaco-editor/react';
import { isElectron } from '@/lib/platform';

if (isElectron()) {
  void import('monaco-editor').then((monaco) => {
    loader.config({ monaco });
  });
}
