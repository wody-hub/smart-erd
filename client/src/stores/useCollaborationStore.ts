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
  /** 원격 사용자 Awareness 상태 맵 (clientId -> state) */
  remoteCursors: Map<number, AwarenessState>;

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

  /** 모든 협업 상태를 초기화한다. */
  reset: () => void;
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

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setPresenceMode: (mode) => set({ presenceMode: mode }),
  setSelfUserId: (userId) =>
    set((state) => {
      if (!userId) {
        return { selfUserId: userId };
      }

      const cursors = new Map(state.remoteCursors);
      for (const [clientId, awareness] of cursors) {
        if (awareness.user?.userId === userId) {
          cursors.delete(clientId);
        }
      }

      return {
        selfUserId: userId,
        remoteCursors: cursors,
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

    const cursors = new Map(state.remoteCursors);
    for (const [clientId, awareness] of cursors) {
      if (awareness.user?.userId === payload.userId) {
        cursors.delete(clientId);
      }
    }

    set({
      participantsByUserId: participants,
      remoteCursors: cursors,
      lastPresenceVersion: payload.presenceVersion,
    });
  },

  updateAwareness: (clientId, state) => {
    const currentState = get();
    const cursors = new Map(currentState.remoteCursors);
    const selfUserId = currentState.selfUserId;
    if (state === null) {
      cursors.delete(clientId);
    } else {
      if (selfUserId && state.user?.userId === selfUserId) {
        cursors.delete(clientId);
        set({ remoteCursors: cursors });
        return;
      }
      cursors.set(clientId, state);
    }
    set({ remoteCursors: cursors });
  },

  removePeerByLoginId: (loginId) => {
    const cursors = new Map(get().remoteCursors);
    for (const [clientId, state] of cursors) {
      if (state.user?.loginId === loginId) {
        cursors.delete(clientId);
      }
    }
    set({ remoteCursors: cursors });
  },

  removePeerByUserId: (userId) => {
    const cursors = new Map(get().remoteCursors);
    for (const [clientId, state] of cursors) {
      if (state.user?.userId === userId) {
        cursors.delete(clientId);
      }
    }
    set({ remoteCursors: cursors });
  },

  reset: () =>
    set({
      connectionStatus: 'disconnected',
      presenceMode: 'active',
      lastRoomEpoch: null,
      lastPresenceVersion: 0,
      participantsByUserId: new Map(),
      selfUserId: null,
      remoteCursors: new Map(),
    }),
}));

export default useCollaborationStore;
