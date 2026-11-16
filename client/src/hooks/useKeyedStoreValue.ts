import { useCallback, useSyncExternalStore } from 'react';
import type { KeyedStore } from '@/lib/keyed-external-store';

/**
 * 외부 스토어에서 지정한 ID의 엔트리만 구독한다.
 * @param store ID별 스토어
 * @param key 구독할 ID
 * @returns 해당 ID의 현재 값
 */
export function useKeyedStoreValue<T>(store: KeyedStore<T>, key: string): T | undefined {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [store, key],
  );
  const getSnapshot = useCallback(() => store.get(key), [store, key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
