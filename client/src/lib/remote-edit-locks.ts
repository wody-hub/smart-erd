import type { AwarenessState, PresenceParticipant } from '../types/collaboration.js';
import { LOCK_TTL_MS } from '../constants/collab-lock.js';

/** 원격 편집 락 소유자 정보 */
export interface RemoteEditLockInfo {
  /** 원격 클라이언트 ID */
  clientId: number;
  /** 사용자 ID */
  userId: string | null;
  /** 사용자 표시 이름 */
  name: string;
  /** 로그인 ID */
  loginId: string;
  /** 커서 색상 */
  color: string;
}

/** 원격 락 계산 시 제외할 로컬 사용자 식별자 */
export interface ResolveRemoteEditLocksOptions {
  /** 현재 사용자 ID */
  selfUserId?: string | null;
  /** 현재 사용자 loginId */
  selfLoginId?: string | null;
}

/**
 * 원격 커서 상태에서 테이블 키별 소프트 락 맵을 계산한다.
 *
 * `editingTableKey`를 1순위 편집 락 기준으로 사용하며,
 * 하위 호환을 위해 `selectedNodeId`는 fallback으로만 사용한다.
 * 동일 노드 경쟁 시 `(userId, clientId)` 오름차순으로 1명을 선택한다.
 */
export function resolveRemoteEditLocks(
  remoteCursors: Map<number, AwarenessState>,
  participantsByUserId: Map<string, PresenceParticipant>,
  options?: ResolveRemoteEditLocksOptions,
  nowMs: number = Date.now(),
): Map<string, RemoteEditLockInfo> {
  const locks = new Map<string, RemoteEditLockInfo>();

  for (const [clientId, state] of remoteCursors) {
    const lockKey = state.editingTableKey ?? state.selectedNodeId;
    if (!lockKey) {
      continue;
    }

    const userId = state.user?.userId ?? null;
    const loginId = state.user?.loginId ?? '';
    if (
      (options?.selfUserId && userId === options.selfUserId) ||
      (options?.selfLoginId && loginId === options.selfLoginId)
    ) {
      continue;
    }

    if (participantsByUserId.size > 0) {
      if (!userId || !participantsByUserId.has(userId)) {
        continue;
      }
    }

    if (state.editingTableKey) {
      // editingTableKey 기반 소프트 락은 heartbeat가 반드시 있어야 하며 TTL 검증을 통과해야 한다.
      if (!state.lockHeartbeatAt || nowMs - state.lockHeartbeatAt > LOCK_TTL_MS) {
        continue;
      }
      // awareness payload의 editingClientId가 실제 clientId와 다르면 스푸핑으로 간주한다.
      if (state.editingClientId != null && state.editingClientId !== clientId) {
        continue;
      }
    } else if (state.lockHeartbeatAt && nowMs - state.lockHeartbeatAt > LOCK_TTL_MS) {
      continue;
    }

    const candidate: RemoteEditLockInfo = {
      clientId,
      userId,
      name: state.user?.name ?? 'Unknown',
      loginId,
      color: state.user?.color ?? 'hsl(var(--muted-foreground))',
    };

    const current = locks.get(lockKey);
    if (!current) {
      locks.set(lockKey, candidate);
      continue;
    }

    const currentKey = `${current.userId ?? ''}:${String(current.clientId).padStart(12, '0')}`;
    const nextKey = `${candidate.userId ?? ''}:${String(candidate.clientId).padStart(12, '0')}`;
    if (nextKey < currentKey) {
      locks.set(lockKey, candidate);
    }
  }

  return locks;
}
