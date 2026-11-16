/** ID별 스냅샷과 구독을 제공하는 외부 스토어. */
export interface KeyedStore<T> {
  get: (key: string) => T | undefined;
  subscribe: (key: string, listener: () => void) => () => void;
  update: (next: Map<string, T>) => void;
}

/**
 * 값이 같은 엔트리와 전체 Map의 참조를 재사용한다. 입력 Map은 변경하지 않는다.
 * @param previous 이전 스냅샷
 * @param next 새로 계산한 스냅샷
 * @param equal 엔트리 내용 비교 함수
 * @returns 변경 없는 엔트리를 공유하는 스냅샷
 */
export function shareMapEntries<T>(
  previous: Map<string, T>,
  next: Map<string, T>,
  equal: (left: T, right: T) => boolean,
): Map<string, T> {
  const shared = new Map<string, T>();
  let unchanged = previous.size === next.size;
  for (const [key, value] of next) {
    const oldValue = previous.get(key);
    if (previous.has(key) && equal(oldValue as T, value)) {
      shared.set(key, oldValue as T);
    } else {
      shared.set(key, value);
      unchanged = false;
    }
  }
  return unchanged ? previous : shared;
}

/**
 * 전체 스냅샷을 먼저 교체하고 실제로 바뀐 ID의 구독자만 알리는 스토어를 만든다.
 * @param initial 최초 스냅샷
 * @param equal 엔트리 내용 비교 함수
 * @returns ID 단위 외부 스토어
 */
export function createKeyedStore<T>(
  initial: Map<string, T>,
  equal: (left: T, right: T) => boolean = Object.is,
): KeyedStore<T> {
  let snapshot = initial;
  const listeners = new Map<string, Set<() => void>>();
  return {
    /**
     * ID의 현재 값을 조회한다.
     * @param key 대상 ID
     * @returns 현재 엔트리 또는 undefined
     */
    get(key) {
      return snapshot.get(key);
    },
    /**
     * ID의 변경을 구독한다.
     * @param key 대상 ID
     * @param listener 변경 콜백
     * @returns 구독 해제 함수
     */
    subscribe(key, listener) {
      const subscribers = listeners.get(key) ?? new Set<() => void>();
      /**
       * 같은 콜백으로 등록한 구독도 개별 해제할 수 있도록 호출을 감싼다.
       * @returns 변경 콜백 호출 결과
       */
      const subscription = () => listener();
      subscribers.add(subscription);
      listeners.set(key, subscribers);
      return () => {
        subscribers.delete(subscription);
        if (subscribers.size === 0) listeners.delete(key);
      };
    },
    /**
     * 엔트리를 공유하고 변경된 키만 알린다.
     * @param next 새 스냅샷
     */
    update(next): void {
      const previous = snapshot;
      snapshot = shareMapEntries(previous, next, equal);
      if (snapshot === previous) return;
      const changedKeys = new Set([...previous.keys(), ...snapshot.keys()]);
      for (const key of changedKeys) {
        if (
          previous.has(key) === snapshot.has(key) &&
          Object.is(previous.get(key), snapshot.get(key))
        )
          continue;
        for (const listener of [...(listeners.get(key) ?? [])]) listener();
      }
    },
  };
}
