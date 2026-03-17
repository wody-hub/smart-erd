import { useState, useEffect } from 'react';

/**
 * 다크 모드 상태를 반응형으로 감지하는 훅.
 *
 * `document.documentElement`의 `class` 속성 변경을 MutationObserver로 감시하여
 * 런타임에 다크 모드가 전환되면 자동으로 상태를 갱신한다.
 *
 * @returns 다크 모드 활성화 여부
 */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains('dark'));
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
