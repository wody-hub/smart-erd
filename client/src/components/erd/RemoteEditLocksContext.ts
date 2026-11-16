import { createContext, useContext } from 'react';
import { createKeyedStore } from '@/lib/keyed-external-store';
import { useKeyedStoreValue } from '@/hooks/useKeyedStoreValue';
import type { RemoteEditLockInfo } from '@/lib/remote-edit-locks';
import type { EdgeWaypointPreview } from '@/types/collaboration';

export interface RemoteEditLocksContextValue {
  locksByTableKey: Map<string, RemoteEditLockInfo>;
  locksByNodeId: Map<string, RemoteEditLockInfo>;
  edgeLocksById: Map<string, RemoteEditLockInfo>;
  edgePreviewsById: Map<string, EdgeWaypointPreview>;
  hasTableLocks: boolean;
  hasAnyActiveEdgeDrag: boolean;
  hasBlockingStructureLocks: boolean;
}

const EMPTY_LOCKS = new Map<string, RemoteEditLockInfo>();
const EMPTY_PREVIEWS = new Map<string, EdgeWaypointPreview>();

export const RemoteEditLocksContext = createContext<RemoteEditLocksContextValue>({
  locksByTableKey: EMPTY_LOCKS,
  locksByNodeId: EMPTY_LOCKS,
  edgeLocksById: EMPTY_LOCKS,
  edgePreviewsById: EMPTY_PREVIEWS,
  hasTableLocks: false,
  hasAnyActiveEdgeDrag: false,
  hasBlockingStructureLocks: false,
});

export function useRemoteEditLocksContext(): RemoteEditLocksContextValue {
  return useContext(RemoteEditLocksContext);
}

/** 노드별 구독용 컨텍스트는 Provider 수명 동안 같은 스토어를 유지한다. */
export const RemoteEditLockStoreContext = createContext(
  createKeyedStore<RemoteEditLockInfo>(new Map()),
);

/**
 * 지정한 노드의 원격 잠금만 구독한다. 테이블 키 fallback은 Provider 입력 계산에 반영된다.
 * @param nodeId 구독할 노드 ID
 * @returns 해당 노드의 원격 잠금 소유자
 */
export function useRemoteEditLock(nodeId: string): RemoteEditLockInfo | undefined {
  return useKeyedStoreValue(useContext(RemoteEditLockStoreContext), nodeId);
}
