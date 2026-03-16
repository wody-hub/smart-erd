import { useEffect, useMemo, useState } from 'react';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useAuthStore from '@/stores/useAuthStore';
import { LOCK_HEARTBEAT_MS } from '@/constants/collab-lock';
import { buildTableLockKeyFromNodeData } from '@/lib/table-lock-key';
import {
  resolveRemoteEditLocks,
  resolveRemoteEdgeEditLocks,
  type RemoteEditLockInfo,
} from '@/lib/remote-edit-locks';
import type { EdgeWaypointPreview } from '@/types/collaboration';

/** 원격 편집 락 계산 결과 */
interface UseRemoteEditLocksReturn {
  /** 테이블 키별 락 소유자 맵 */
  locksByTableKey: Map<string, RemoteEditLockInfo>;
  /** 노드 ID별 락 소유자 맵 */
  locksByNodeId: Map<string, RemoteEditLockInfo>;
  /** edge ID별 락 소유자 맵 */
  edgeLocksById: Map<string, RemoteEditLockInfo>;
  /** edge ID별 preview 맵 */
  edgePreviewsById: Map<string, EdgeWaypointPreview>;
  /** 원격 테이블 락 존재 여부 */
  hasTableLocks: boolean;
  /** 로컬/원격 edge drag 존재 여부 */
  hasAnyActiveEdgeDrag: boolean;
  /** 구조 변경 차단 여부 */
  hasBlockingStructureLocks: boolean;
}

/**
 * 원격 Awareness 상태에서 테이블/edge 편집 락 맵을 계산한다.
 */
export function useRemoteEditLocks(): UseRemoteEditLocksReturn {
  const remoteCursors = useCollaborationStore((s) => s.remoteCursors);
  const remoteEdgeAwareness = useCollaborationStore((s) => s.remoteEdgeAwareness);
  const participantsByUserId = useCollaborationStore((s) => s.participantsByUserId);
  const selfUserId = useCollaborationStore((s) => s.selfUserId);
  const localEdgeDrag = useCollaborationStore((s) => s.localEdgeDrag);
  const selfLoginId = useAuthStore((s) => s.loginId);
  const nodes = useCanvasStore((s) => s.nodes);
  const [ttlTick, setTtlTick] = useState(0);

  useEffect(() => {
    if (remoteCursors.size === 0 && remoteEdgeAwareness.size === 0) {
      return;
    }
    const timerId = setInterval(() => {
      setTtlTick((prev) => prev + 1);
    }, LOCK_HEARTBEAT_MS);
    return () => clearInterval(timerId);
  }, [remoteCursors.size, remoteEdgeAwareness.size]);

  const locksByTableKey = useMemo(() => {
    void ttlTick;
    return resolveRemoteEditLocks(
      remoteCursors,
      participantsByUserId,
      { selfUserId, selfLoginId },
      Date.now(),
    );
  }, [participantsByUserId, remoteCursors, selfLoginId, selfUserId, ttlTick]);

  const locksByNodeId = useMemo(() => {
    const byNodeId = new Map<string, RemoteEditLockInfo>();
    for (const node of nodes) {
      const tableKey = buildTableLockKeyFromNodeData(node.data);
      const lockInfo = locksByTableKey.get(tableKey) ?? locksByTableKey.get(node.id);
      if (lockInfo) {
        byNodeId.set(node.id, lockInfo);
      }
    }
    return byNodeId;
  }, [locksByTableKey, nodes]);

  const resolvedEdgeLocks = useMemo(() => {
    void ttlTick;
    return resolveRemoteEdgeEditLocks(
      remoteEdgeAwareness,
      participantsByUserId,
      { selfUserId, selfLoginId },
      Date.now(),
    );
  }, [participantsByUserId, remoteEdgeAwareness, selfLoginId, selfUserId, ttlTick]);

  const edgeLocksById = useMemo(() => {
    const locks = new Map<string, RemoteEditLockInfo>();
    for (const [edgeId, resolved] of resolvedEdgeLocks) {
      locks.set(edgeId, resolved.info);
    }
    return locks;
  }, [resolvedEdgeLocks]);

  const edgePreviewsById = useMemo(() => {
    const previews = new Map<string, EdgeWaypointPreview>();
    for (const [edgeId, resolved] of resolvedEdgeLocks) {
      if (resolved.preview) {
        previews.set(edgeId, resolved.preview);
      }
    }
    return previews;
  }, [resolvedEdgeLocks]);

  const hasTableLocks = locksByTableKey.size > 0;
  const hasAnyActiveEdgeDrag = !!localEdgeDrag || edgeLocksById.size > 0;

  return {
    locksByTableKey,
    locksByNodeId,
    edgeLocksById,
    edgePreviewsById,
    hasTableLocks,
    hasAnyActiveEdgeDrag,
    hasBlockingStructureLocks: hasTableLocks || hasAnyActiveEdgeDrag,
  };
}
