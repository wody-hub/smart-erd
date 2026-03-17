import { createContext, useContext } from 'react';
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
