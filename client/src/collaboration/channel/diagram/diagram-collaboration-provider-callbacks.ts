import type {
  AwarenessState,
  ConnectionStatus,
  PresenceMode,
  PresencePeerJoinedPayload,
  PresencePeerLeftPayload,
  PresenceSnapshotPayload,
} from '../../../types/collaboration.js';

export interface DiagramCollaborationProviderBindingCallbacks {
  onConnectionStatusChange: (status: ConnectionStatus) => void;
  onIdentityResolved: (userId: string) => void;
  onPresenceModeChange: (mode: PresenceMode) => void;
  onPresenceSnapshot: (payload: PresenceSnapshotPayload) => void;
  onPresencePeerJoined: (payload: PresencePeerJoinedPayload) => void;
  onPresencePeerLeft: (payload: PresencePeerLeftPayload) => void;
  onAwarenessReceived: (clientId: number, state: AwarenessState | null) => void;
  onPeerLeft: (loginId: string) => void;
}
