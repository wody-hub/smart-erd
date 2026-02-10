import { create } from 'zustand';
import type { AwarenessState, ConnectionStatus } from '@/types/collaboration';

/**
 * 실시간 협업 상태를 관리하는 Zustand 스토어의 상태 인터페이스.
 * Awareness 상태의 SSOT(Single Source of Truth) — Provider는 이벤트만 전달.
 */
interface CollaborationState {
  /** WebSocket 연결 상태 */
  connectionStatus: ConnectionStatus;
  /** 원격 사용자 Awareness 상태 맵 (clientId → state) */
  remoteCursors: Map<number, AwarenessState>;
  /** 연결 상태를 설정한다. @param status 연결 상태 */
  setConnectionStatus: (status: ConnectionStatus) => void;
  /** 개별 Awareness 수신 시 상태를 업데이트한다. @param clientId 클라이언트 ID @param state 상태 (null이면 제거) */
  updateAwareness: (clientId: number, state: AwarenessState | null) => void;
  /** loginId 기반으로 해당 사용자의 커서를 제거한다. @param loginId 퇴장한 사용자 loginId */
  removePeerByLoginId: (loginId: string) => void;
  /** 모든 협업 상태를 초기화한다. */
  reset: () => void;
}

/**
 * 실시간 협업 상태 관리 Zustand 스토어.
 *
 * WebSocket 연결 상태, 원격 사용자 커서/Awareness를 관리한다.
 */
const useCollaborationStore = create<CollaborationState>((set, get) => ({
  connectionStatus: 'disconnected',
  remoteCursors: new Map(),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  updateAwareness: (clientId, state) => {
    const cursors = new Map(get().remoteCursors);
    if (state === null) {
      cursors.delete(clientId);
    } else {
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

  reset: () =>
    set({
      connectionStatus: 'disconnected',
      remoteCursors: new Map(),
    }),
}));

export default useCollaborationStore;
