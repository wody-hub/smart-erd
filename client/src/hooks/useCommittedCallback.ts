import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * 함수 참조를 유지하면서 마지막 커밋의 콜백을 호출한다.
 * @param callback 최신 이벤트 처리 함수
 * @returns 참조가 안정적인 이벤트 처리 함수
 */
export function useCommittedCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  return useCallback((...args: Args) => callbackRef.current(...args), []);
}
