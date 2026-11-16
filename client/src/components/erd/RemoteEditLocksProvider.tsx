import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createKeyedStore } from '@/lib/keyed-external-store';
import { areRemoteEditLocksEqual } from '@/lib/remote-edit-locks';
import {
  RemoteEditLocksContext,
  RemoteEditLockStoreContext,
  type RemoteEditLocksContextValue,
} from './RemoteEditLocksContext';

interface RemoteEditLocksProviderProps {
  value: RemoteEditLocksContextValue;
  children: ReactNode;
}

/**
 * 기존 전체 잠금 컨텍스트와 노드별 구독 스토어를 함께 제공한다.
 * @param props 잠금 값과 하위 요소
 * @returns 잠금 Provider 트리
 */
export default function RemoteEditLocksProvider({ value, children }: RemoteEditLocksProviderProps) {
  const [store] = useState(() => createKeyedStore(value.locksByNodeId, areRemoteEditLocksEqual));
  useLayoutEffect(() => store.update(value.locksByNodeId), [store, value.locksByNodeId]);
  return (
    <RemoteEditLocksContext.Provider value={value}>
      <RemoteEditLockStoreContext.Provider value={store}>
        {children}
      </RemoteEditLockStoreContext.Provider>
    </RemoteEditLocksContext.Provider>
  );
}
