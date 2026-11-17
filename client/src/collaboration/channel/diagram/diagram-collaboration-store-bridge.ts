import type { ProjectionRefreshRequest } from '@/collaboration/core/contracts/document-plugin';
import type {
  AwarenessState,
  ConnectionIssueKind,
  ConnectionStatus,
  DocumentChangeSummary,
  PresenceMode,
  PresencePeerJoinedPayload,
  PresencePeerLeftPayload,
  PresenceSnapshotPayload,
} from '../../../types/collaboration.js';

export interface DiagramCollaborationStoreBridge {
  loadPreview: (content: string) => void;
  refreshPersistedCanvasFromYDoc: (request?: ProjectionRefreshRequest) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setConnectionIssue: (issue: ConnectionIssueKind | null) => void;
  setPresenceMode: (mode: PresenceMode) => void;
  setSelfUserId: (userId: string) => void;
  applyPresenceSnapshot: (payload: PresenceSnapshotPayload) => void;
  applyPeerJoined: (payload: PresencePeerJoinedPayload) => void;
  applyPeerLeft: (payload: PresencePeerLeftPayload) => void;
  updateAwareness: (clientId: number, state: AwarenessState | null) => void;
  removePeerByUserId: (userId: string) => void;
  removePeerByLoginId: (loginId: string) => void;
  applyDocumentChange: (summary: DocumentChangeSummary) => void;
  resetCollaboration: () => void;
}
