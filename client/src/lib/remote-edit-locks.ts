import type {
  AwarenessState,
  EdgeWaypointPreview,
  PresenceParticipant,
} from '../types/collaboration.js';
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

/** edge soft-lock 계산 결과 */
export interface ResolvedRemoteEdgeLock {
  /** edge 락 소유자 정보 */
  info: RemoteEditLockInfo;
  /** 대상 edge에 대한 최신 preview */
  preview: EdgeWaypointPreview | null;
}

/** 원격 락 계산 시 제외할 로컬 사용자 식별자 */
export interface ResolveRemoteEditLocksOptions {
  /** 현재 사용자 ID */
  selfUserId?: string | null;
  /** 현재 사용자 loginId */
  selfLoginId?: string | null;
}

function isSelfAwareness(state: AwarenessState, options?: ResolveRemoteEditLocksOptions): boolean {
  const userId = state.user?.userId ?? null;
  const loginId = state.user?.loginId ?? '';
  return Boolean(
    (options?.selfUserId && userId === options.selfUserId) ||
    (options?.selfLoginId && loginId === options.selfLoginId),
  );
}

function isParticipantEligible(
  state: AwarenessState,
  participantsByUserId: Map<string, PresenceParticipant>,
): boolean {
  if (participantsByUserId.size === 0) {
    return true;
  }
  const userId = state.user?.userId ?? null;
  return !!userId && participantsByUserId.has(userId);
}

function buildLockCandidate(clientId: number, state: AwarenessState): RemoteEditLockInfo {
  return {
    clientId,
    userId: state.user?.userId ?? null,
    name: state.user?.name ?? 'Unknown',
    loginId: state.user?.loginId ?? '',
    color: state.user?.color ?? 'hsl(var(--muted-foreground))',
  };
}

function compareLockCandidate(current: RemoteEditLockInfo, next: RemoteEditLockInfo): boolean {
  const currentKey = `${current.userId ?? ''}:${String(current.clientId).padStart(12, '0')}`;
  const nextKey = `${next.userId ?? ''}:${String(next.clientId).padStart(12, '0')}`;
  return nextKey < currentKey;
}

/**
 * 원격 커서 상태에서 테이블 키별 소프트 락 맵을 계산한다.
 *
 * `editingTableKey`를 1순위 편집 락 기준으로 사용하며,
 * 하위 호환을 위해 `selectedNodeId`는 fallback으로만 사용한다.
 * `editingEdgeId`가 존재하는 awareness는 `selectedNodeId` fallback 락 후보에서 제외한다.
 */
export function resolveRemoteEditLocks(
  remoteCursors: Map<number, AwarenessState>,
  participantsByUserId: Map<string, PresenceParticipant>,
  options?: ResolveRemoteEditLocksOptions,
  nowMs: number = Date.now(),
): Map<string, RemoteEditLockInfo> {
  const locks = new Map<string, RemoteEditLockInfo>();

  for (const [clientId, state] of remoteCursors) {
    const lockKey = state.editingTableKey ?? (state.editingEdgeId ? null : state.selectedNodeId);
    if (!lockKey) {
      continue;
    }
    if (isSelfAwareness(state, options) || !isParticipantEligible(state, participantsByUserId)) {
      continue;
    }

    if (state.editingTableKey) {
      if (!state.lockHeartbeatAt || nowMs - state.lockHeartbeatAt > LOCK_TTL_MS) {
        continue;
      }
      if (state.editingClientId != null && state.editingClientId !== clientId) {
        continue;
      }
    } else if (state.lockHeartbeatAt && nowMs - state.lockHeartbeatAt > LOCK_TTL_MS) {
      continue;
    }

    const candidate = buildLockCandidate(clientId, state);
    const current = locks.get(lockKey);
    if (!current || compareLockCandidate(current, candidate)) {
      locks.set(lockKey, candidate);
    }
  }

  return locks;
}

/**
 * 원격 edge soft-lock과 preview를 edge ID별로 계산한다.
 */
export function resolveRemoteEdgeEditLocks(
  remoteEdgeAwareness: Map<number, AwarenessState>,
  participantsByUserId: Map<string, PresenceParticipant>,
  options?: ResolveRemoteEditLocksOptions,
  nowMs: number = Date.now(),
): Map<string, ResolvedRemoteEdgeLock> {
  const locks = new Map<string, ResolvedRemoteEdgeLock>();

  for (const [clientId, state] of remoteEdgeAwareness) {
    const edgeId = state.editingEdgeId;
    if (!edgeId) {
      continue;
    }
    if (isSelfAwareness(state, options) || !isParticipantEligible(state, participantsByUserId)) {
      continue;
    }
    if (!state.edgeLockHeartbeatAt || nowMs - state.edgeLockHeartbeatAt > LOCK_TTL_MS) {
      continue;
    }
    if (state.editingEdgeClientId != null && state.editingEdgeClientId !== clientId) {
      continue;
    }

    const candidate = buildLockCandidate(clientId, state);
    const current = locks.get(edgeId);
    if (current && !compareLockCandidate(current.info, candidate)) {
      continue;
    }

    locks.set(edgeId, {
      info: candidate,
      preview:
        state.edgeWaypointPreview && state.edgeWaypointPreview.edgeId === edgeId
          ? state.edgeWaypointPreview
          : null,
    });
  }

  return locks;
}
