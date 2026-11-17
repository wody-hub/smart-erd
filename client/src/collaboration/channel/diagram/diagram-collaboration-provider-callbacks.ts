import type {
  AwarenessState,
  ConnectionIssueKind,
  ConnectionStatus,
  PresenceMode,
  PresencePeerJoinedPayload,
  PresencePeerLeftPayload,
  PresenceSnapshotPayload,
} from '../../../types/collaboration.js';

export interface DiagramCollaborationProviderBindingCallbacks {
  /** 현재 연결에서 받은 서버의 빈 문서 초기화 확인 콜백 */
  onEmptyDocumentInitialized?: () => void;
  /** snapshot 초기화 지연 안내 콜백 */
  onInitializationDelayed?: () => void;
  onSyncStateChange: (synced: boolean) => void;
  onConnectionStatusChange: (status: ConnectionStatus) => void;
  onConnectionIssueDetected: (issue: ConnectionIssueKind | null) => void;
  onIdentityResolved: (userId: string) => void;
  onPresenceModeChange: (mode: PresenceMode) => void;
  onPresenceSnapshot: (payload: PresenceSnapshotPayload) => void;
  onPresencePeerJoined: (payload: PresencePeerJoinedPayload) => void;
  onPresencePeerLeft: (payload: PresencePeerLeftPayload) => void;
  onAwarenessReceived: (clientId: number, state: AwarenessState | null) => void;
  onPeerLeft: (loginId: string) => void;
}
