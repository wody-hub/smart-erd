import type {
  AwarenessState,
  ConnectionStatus,
  PresenceMode,
  PresencePeerJoinedPayload,
  PresencePeerLeftPayload,
  PresenceSnapshotPayload,
} from '../../../types/collaboration.js';

export interface DiagramCollaborationStoreBridge {
  loadPreview: (content: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setPresenceMode: (mode: PresenceMode) => void;
  setSelfUserId: (userId: string) => void;
  applyPresenceSnapshot: (payload: PresenceSnapshotPayload) => void;
  applyPeerJoined: (payload: PresencePeerJoinedPayload) => void;
  applyPeerLeft: (payload: PresencePeerLeftPayload) => void;
  updateAwareness: (clientId: number, state: AwarenessState | null) => void;
  removePeerByUserId: (userId: string) => void;
  removePeerByLoginId: (loginId: string) => void;
  resetCollaboration: () => void;
}
