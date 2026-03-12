import { useEffect, useMemo, useState } from 'react';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useAuthStore from '@/stores/useAuthStore';
import { LOCK_HEARTBEAT_MS } from '@/constants/collab-lock';
import { buildTableLockKeyFromNodeData } from '@/lib/table-lock-key';
import { resolveRemoteEditLocks, type RemoteEditLockInfo } from '@/lib/remote-edit-locks';

/** 원격 편집 락 계산 결과 */
interface UseRemoteEditLocksReturn {
  /** 테이블 키별 락 소유자 맵 */
  locksByTableKey: Map<string, RemoteEditLockInfo>;
  /** 노드 ID별 락 소유자 맵 */
  locksByNodeId: Map<string, RemoteEditLockInfo>;
  /** 원격 편집 락 존재 여부 */
  hasLocks: boolean;
}

/**
 * 원격 Awareness 상태에서 테이블 편집 락 맵을 계산한다.
 *
 * `editingTableKey`를 원격 테이블 편집 락 기준으로 사용한다.
 * 동일 키에 복수 락 후보가 있으면 `(userId, clientId)` 오름차순으로 1명을 선택한다.
 */
export function useRemoteEditLocks(): UseRemoteEditLocksReturn {
  const remoteCursors = useCollaborationStore((s) => s.remoteCursors);
  const participantsByUserId = useCollaborationStore((s) => s.participantsByUserId);
  const selfUserId = useCollaborationStore((s) => s.selfUserId);
  const selfLoginId = useAuthStore((s) => s.loginId);
  const nodes = useCanvasStore((s) => s.nodes);
  const [ttlTick, setTtlTick] = useState(0);

  useEffect(() => {
    if (remoteCursors.size === 0) {
      return;
    }
    const timerId = setInterval(() => {
      setTtlTick((prev) => prev + 1);
    }, LOCK_HEARTBEAT_MS);
    return () => clearInterval(timerId);
  }, [remoteCursors.size]);

  const locksByTableKey = useMemo(() => {
    // remote cursor 값이 그대로여도 ttlTick 변경으로 stale 만료 재평가가 필요하다.
    void ttlTick;
    const nowMs = Date.now();
    return resolveRemoteEditLocks(
      remoteCursors,
      participantsByUserId,
      { selfUserId, selfLoginId },
      nowMs,
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

  return {
    locksByTableKey,
    locksByNodeId,
    hasLocks: locksByTableKey.size > 0,
  };
}
