import { useCallback, useEffect, useMemo, useRef } from 'react';

/** clearable setTimeout 관리 유틸리티 반환 타입 */
interface ClearableTimer {
  /** 현재 타이머를 취소한다 */
  clear: () => void;
  /** 기존 타이머를 취소하고 새 타이머를 설정한다 */
  set: (fn: () => void, ms: number) => void;
}

/**
 * clearTimeout + ref 관리를 캡슐화한 유틸리티 훅.
 *
 * clear/set 메서드는 렌더 간 안정 참조를 유지한다.
 *
 * @returns clear/set 메서드를 가진 타이머 객체
 */
export function useClearableTimer(): ClearableTimer {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const set = useCallback(
    (fn: () => void, ms: number) => {
      clear();
      timerRef.current = setTimeout(fn, ms);
    },
    [clear],
  );

  // 컴포넌트 unmount 시 잔존 타이머를 자동 정리한다
  useEffect(() => () => clear(), [clear]);

  // useEffect deps에서 안정 참조를 보장한다
  return useMemo(() => ({ clear, set }), [clear, set]);
}
