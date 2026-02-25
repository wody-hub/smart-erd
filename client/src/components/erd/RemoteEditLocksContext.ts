import { createContext, useContext } from 'react';
import type { RemoteEditLockInfo } from '@/lib/remote-edit-locks';

export interface RemoteEditLocksContextValue {
  locksByTableKey: Map<string, RemoteEditLockInfo>;
  locksByNodeId: Map<string, RemoteEditLockInfo>;
  hasLocks: boolean;
}

const EMPTY_LOCKS = new Map<string, RemoteEditLockInfo>();

export const RemoteEditLocksContext = createContext<RemoteEditLocksContextValue>({
  locksByTableKey: EMPTY_LOCKS,
  locksByNodeId: EMPTY_LOCKS,
  hasLocks: false,
});

export function useRemoteEditLocksContext(): RemoteEditLocksContextValue {
  return useContext(RemoteEditLocksContext);
}
