import { create } from 'zustand';
import type {
  AwarenessState,
  ConnectionStatus,
  PresenceMode,
  PresenceParticipant,
  PresencePeerJoinedPayload,
  PresencePeerLeftPayload,
  PresenceSnapshotPayload,
} from '@/types/collaboration';
import type { Waypoint } from '@/types/erd';

export type LocalEdgeWaypointDragKind = 'segment';

export interface LocalEdgeWaypointDrag {
  edgeId: string;
  pointerId: number;
  segmentIndex: number;
  axis: 'x' | 'y';
  kind: LocalEdgeWaypointDragKind;
  routePoints: Waypoint[];
  initialWaypoints: Waypoint[];
  previewWaypoints: Waypoint[];
}

/**
 * 실시간 협업 상태를 관리하는 Zustand 스토어의 상태 인터페이스.
 */
interface CollaborationState {
  /** WebSocket 연결 상태 */
  connectionStatus: ConnectionStatus;
  /** Presence 모드 */
  presenceMode: PresenceMode;
  /** 최근 room epoch */
  lastRoomEpoch: string | null;
  /** 최근 presence version */
  lastPresenceVersion: number;
  /** 참여자 맵 (userId -> participant) */
  participantsByUserId: Map<string, PresenceParticipant>;
  /** 현재 로그인 사용자의 userId */
  selfUserId: string | null;
  /** 원격 사용자 커서/테이블 편집 Awareness 상태 맵 (clientId -> state) */
  remoteCursors: Map<number, AwarenessState>;
  /** 원격 edge 편집 Awareness 상태 맵 (clientId -> state) */
  remoteEdgeAwareness: Map<number, AwarenessState>;
  /** 로컬 edge waypoint 드래그 세션 */
  localEdgeDrag: LocalEdgeWaypointDrag | null;

  /** 연결 상태를 설정한다. */
  setConnectionStatus: (status: ConnectionStatus) => void;
  /** Presence 모드를 설정한다. */
  setPresenceMode: (mode: PresenceMode) => void;
  /** 현재 사용자 userId를 설정한다. */
  setSelfUserId: (userId: string | null) => void;
  /** Presence snapshot을 적용한다. */
  applyPresenceSnapshot: (payload: PresenceSnapshotPayload) => void;
  /** Peer joined 이벤트를 적용한다. */
  applyPeerJoined: (payload: PresencePeerJoinedPayload) => void;
  /** Peer left 이벤트를 적용한다. */
  applyPeerLeft: (payload: PresencePeerLeftPayload) => void;

  /** 개별 Awareness 수신 시 상태를 업데이트한다. */
  updateAwareness: (clientId: number, state: AwarenessState | null) => void;
  /** loginId 기반으로 해당 사용자의 커서를 제거한다. (legacy 0x07용) */
  removePeerByLoginId: (loginId: string) => void;
  /** userId 기반으로 해당 사용자의 커서를 제거한다. */
  removePeerByUserId: (userId: string) => void;
  /** 로컬 edge drag 세션을 시작한다. */
  setLocalEdgeDrag: (drag: LocalEdgeWaypointDrag | null) => void;
  /** 로컬 edge drag preview를 갱신한다. */
  updateLocalEdgeDragPreview: (waypoints: Waypoint[], routePoints?: Waypoint[]) => void;
  /** 로컬 edge drag 세션을 종료한다. */
  clearLocalEdgeDrag: () => void;

  /** 모든 협업 상태를 초기화한다. */
  reset: () => void;
}

function cloneWaypoints(waypoints: Waypoint[]): Waypoint[] {
  return waypoints.map((waypoint) => ({ x: waypoint.x, y: waypoint.y }));
}

function areWaypointsEqual(left?: Waypoint[] | null, right?: Waypoint[] | null): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  return left.every(
    (waypoint, index) =>
      waypoint.x === right[index]?.x && waypoint.y === right[index]?.y,
  );
}

function areUsersEqual(
  left?: AwarenessState['user'] | null,
  right?: AwarenessState['user'] | null,
): boolean {
  return (
    (left?.userId ?? null) === (right?.userId ?? null) &&
    (left?.name ?? '') === (right?.name ?? '') &&
    (left?.loginId ?? '') === (right?.loginId ?? '') &&
    (left?.color ?? '') === (right?.color ?? '')
  );
}

function areCursorAwarenessEqual(
  left?: AwarenessState | null,
  right?: AwarenessState | null,
): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    areUsersEqual(left.user, right.user) &&
    (left.cursor?.x ?? null) === (right.cursor?.x ?? null) &&
    (left.cursor?.y ?? null) === (right.cursor?.y ?? null) &&
    (left.selectedNodeId ?? null) === (right.selectedNodeId ?? null) &&
    (left.editingNodeId ?? null) === (right.editingNodeId ?? null) &&
    (left.editingTableKey ?? null) === (right.editingTableKey ?? null) &&
    (left.editingSource ?? null) === (right.editingSource ?? null) &&
    (left.editingClientId ?? null) === (right.editingClientId ?? null) &&
    (left.lockHeartbeatAt ?? null) === (right.lockHeartbeatAt ?? null)
  );
}

function areEdgeAwarenessEqual(left?: AwarenessState | null, right?: AwarenessState | null): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    areUsersEqual(left.user, right.user) &&
    (left.editingEdgeId ?? null) === (right.editingEdgeId ?? null) &&
    (left.editingEdgeClientId ?? null) === (right.editingEdgeClientId ?? null) &&
    (left.edgeLockHeartbeatAt ?? null) === (right.edgeLockHeartbeatAt ?? null) &&
    (left.edgeWaypointPreview?.edgeId ?? null) === (right.edgeWaypointPreview?.edgeId ?? null) &&
    areWaypointsEqual(left.edgeWaypointPreview?.waypoints, right.edgeWaypointPreview?.waypoints)
  );
}

function normalizeCursorAwareness(state: AwarenessState): AwarenessState {
  return {
    user: state.user,
    cursor: state.cursor,
    selectedNodeId: state.editingEdgeId ? null : (state.selectedNodeId ?? null),
    editingNodeId: state.editingEdgeId ? null : (state.editingNodeId ?? null),
    editingTableKey: state.editingEdgeId ? null : (state.editingTableKey ?? null),
    editingSource: state.editingEdgeId ? null : (state.editingSource ?? null),
    editingClientId: state.editingEdgeId ? null : (state.editingClientId ?? null),
    lockHeartbeatAt: state.editingEdgeId ? null : (state.lockHeartbeatAt ?? null),
  };
}

function extractEdgeAwareness(state: AwarenessState): AwarenessState | null {
  if (!state.editingEdgeId && !state.edgeWaypointPreview) {
    return null;
  }

  return {
    user: state.user,
    cursor: null,
    selectedNodeId: null,
    editingEdgeId: state.editingEdgeId ?? null,
    editingEdgeClientId: state.editingEdgeClientId ?? null,
    edgeLockHeartbeatAt: state.edgeLockHeartbeatAt ?? null,
    edgeWaypointPreview: state.edgeWaypointPreview
      ? {
          edgeId: state.edgeWaypointPreview.edgeId,
          waypoints: cloneWaypoints(state.edgeWaypointPreview.waypoints),
        }
      : null,
  };
}

function removeByIdentity(
  source: Map<number, AwarenessState>,
  predicate: (state: AwarenessState) => boolean,
): Map<number, AwarenessState> {
  const next = new Map(source);
  for (const [clientId, awareness] of next) {
    if (predicate(awareness)) {
      next.delete(clientId);
    }
  }
  return next;
}

/**
 * 실시간 협업 상태 관리 Zustand 스토어.
 */
const useCollaborationStore = create<CollaborationState>((set, get) => ({
  connectionStatus: 'disconnected',
  presenceMode: 'active',
  lastRoomEpoch: null,
  lastPresenceVersion: 0,
  participantsByUserId: new Map(),
  selfUserId: null,
  remoteCursors: new Map(),
  remoteEdgeAwareness: new Map(),
  localEdgeDrag: null,

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setPresenceMode: (mode) => set({ presenceMode: mode }),
  setSelfUserId: (userId) =>
    set((state) => {
      if (!userId) {
        return { selfUserId: userId };
      }

      return {
        selfUserId: userId,
        remoteCursors: removeByIdentity(
          state.remoteCursors,
          (awareness) => awareness.user?.userId === userId,
        ),
        remoteEdgeAwareness: removeByIdentity(
          state.remoteEdgeAwareness,
          (awareness) => awareness.user?.userId === userId,
        ),
      };
    }),

  applyPresenceSnapshot: (payload) => {
    const participants = new Map<string, PresenceParticipant>();
    for (const p of payload.participants) {
      participants.set(p.userId, p);
    }
    set({
      participantsByUserId: participants,
      lastRoomEpoch: payload.roomEpoch,
      lastPresenceVersion: payload.presenceVersion,
      presenceMode: 'active',
    });
  },

  applyPeerJoined: (payload) => {
    const state = get();
    if (state.lastRoomEpoch !== payload.roomEpoch) {
      return;
    }
    if (payload.presenceVersion <= state.lastPresenceVersion) {
      return;
    }

    const participants = new Map(state.participantsByUserId);
    participants.set(payload.participant.userId, payload.participant);
    set({
      participantsByUserId: participants,
      lastPresenceVersion: payload.presenceVersion,
    });
  },

  applyPeerLeft: (payload) => {
    const state = get();
    if (state.lastRoomEpoch !== payload.roomEpoch) {
      return;
    }
    if (payload.presenceVersion <= state.lastPresenceVersion) {
      return;
    }

    const participants = new Map(state.participantsByUserId);
    participants.delete(payload.userId);

    set({
      participantsByUserId: participants,
      remoteCursors: removeByIdentity(
        state.remoteCursors,
        (awareness) => awareness.user?.userId === payload.userId,
      ),
      remoteEdgeAwareness: removeByIdentity(
        state.remoteEdgeAwareness,
        (awareness) => awareness.user?.userId === payload.userId,
      ),
      lastPresenceVersion: payload.presenceVersion,
    });
  },

  updateAwareness: (clientId, state) => {
    const currentState = get();
    const selfUserId = currentState.selfUserId;

    if (state === null) {
      set((prev) => {
        if (!prev.remoteCursors.has(clientId) && !prev.remoteEdgeAwareness.has(clientId)) {
          return {};
        }
        const remoteCursors = new Map(prev.remoteCursors);
        const remoteEdgeAwareness = new Map(prev.remoteEdgeAwareness);
        remoteCursors.delete(clientId);
        remoteEdgeAwareness.delete(clientId);
        return { remoteCursors, remoteEdgeAwareness };
      });
      return;
    }

    if (selfUserId && state.user?.userId === selfUserId) {
      set((prev) => {
        const hasCursor = prev.remoteCursors.has(clientId);
        const hasEdge = prev.remoteEdgeAwareness.has(clientId);
        if (!hasCursor && !hasEdge) {
          return {};
        }
        const remoteCursors = new Map(prev.remoteCursors);
        const remoteEdgeAwareness = new Map(prev.remoteEdgeAwareness);
        remoteCursors.delete(clientId);
        remoteEdgeAwareness.delete(clientId);
        return { remoteCursors, remoteEdgeAwareness };
      });
      return;
    }

    const nextCursor = normalizeCursorAwareness(state);
    const nextEdge = extractEdgeAwareness(state);

    set((prev) => {
      const cursorChanged = !areCursorAwarenessEqual(prev.remoteCursors.get(clientId), nextCursor);
      const edgeChanged = !areEdgeAwarenessEqual(prev.remoteEdgeAwareness.get(clientId), nextEdge);

      if (!cursorChanged && !edgeChanged) {
        return {};
      }

      const partial: Partial<CollaborationState> = {};
      if (cursorChanged) {
        const remoteCursors = new Map(prev.remoteCursors);
        remoteCursors.set(clientId, nextCursor);
        partial.remoteCursors = remoteCursors;
      }
      if (edgeChanged) {
        const remoteEdgeAwareness = new Map(prev.remoteEdgeAwareness);
        if (nextEdge) {
          remoteEdgeAwareness.set(clientId, nextEdge);
        } else {
          remoteEdgeAwareness.delete(clientId);
        }
        partial.remoteEdgeAwareness = remoteEdgeAwareness;
      }
      return partial;
    });
  },

  removePeerByLoginId: (loginId) =>
    set((state) => ({
      remoteCursors: removeByIdentity(
        state.remoteCursors,
        (awareness) => awareness.user?.loginId === loginId,
      ),
      remoteEdgeAwareness: removeByIdentity(
        state.remoteEdgeAwareness,
        (awareness) => awareness.user?.loginId === loginId,
      ),
    })),

  removePeerByUserId: (userId) =>
    set((state) => ({
      remoteCursors: removeByIdentity(
        state.remoteCursors,
        (awareness) => awareness.user?.userId === userId,
      ),
      remoteEdgeAwareness: removeByIdentity(
        state.remoteEdgeAwareness,
        (awareness) => awareness.user?.userId === userId,
      ),
    })),

  setLocalEdgeDrag: (drag) =>
    set({
      localEdgeDrag: drag
        ? {
            ...drag,
            routePoints: cloneWaypoints(drag.routePoints),
            initialWaypoints: cloneWaypoints(drag.initialWaypoints),
            previewWaypoints: cloneWaypoints(drag.previewWaypoints),
          }
        : null,
    }),

  updateLocalEdgeDragPreview: (waypoints, routePoints) =>
    set((state) => {
      if (!state.localEdgeDrag) {
        return {};
      }
      return {
        localEdgeDrag: {
          ...state.localEdgeDrag,
          routePoints: routePoints
            ? cloneWaypoints(routePoints)
            : cloneWaypoints(state.localEdgeDrag.routePoints),
          previewWaypoints: cloneWaypoints(waypoints),
        },
      };
    }),

  clearLocalEdgeDrag: () => set({ localEdgeDrag: null }),

  reset: () =>
    set({
      connectionStatus: 'disconnected',
      presenceMode: 'active',
      lastRoomEpoch: null,
      lastPresenceVersion: 0,
      participantsByUserId: new Map(),
      selfUserId: null,
      remoteCursors: new Map(),
      remoteEdgeAwareness: new Map(),
      localEdgeDrag: null,
    }),
}));

export default useCollaborationStore;
