import type { Waypoint } from './erd.js';
import type { ScopeLockMode } from '@/collaboration/core/contracts/document-read-executor';

/** 원격 edge waypoint preview payload */
export interface EdgeWaypointPreview {
  /** preview 대상 edge ID */
  edgeId: string;
  /** flow 좌표 기준 preview 경유점 */
  waypoints: Waypoint[];
}

/**
 * 원격 사용자의 Awareness 상태.
 */
export interface AwarenessState {
  /** 사용자 정보 */
  user: {
    /** 사용자 ID (불변 식별자) */
    userId: string | null;
    /** 사용자 이름 */
    name: string;
    /** 로그인 ID */
    loginId: string;
    /** 커서 색상 (CSS hsl) */
    color: string;
  };
  /** 현재 커서 위치 (null이면 캔버스 밖) */
  cursor: { x: number; y: number } | null;
  /** 현재 선택 중인 노드 ID */
  selectedNodeId: string | null;
  /** 현재 편집 중인 노드 ID (뷰 하이라이트용) */
  editingNodeId?: string | null;
  /** 현재 편집 락 테이블 키 */
  editingTableKey?: string | null;
  /** 편집 소스 */
  editingSource?: 'erd' | 'code' | null;
  /** 편집 클라이언트 ID */
  editingClientId?: number | null;
  /** 락 heartbeat 타임스탬프 (epoch ms) */
  lockHeartbeatAt?: number | null;
  /** 현재 편집 중인 edge ID */
  editingEdgeId?: string | null;
  /** edge 편집 클라이언트 ID */
  editingEdgeClientId?: number | null;
  /** edge 락 heartbeat 타임스탬프 (epoch ms) */
  edgeLockHeartbeatAt?: number | null;
  /** 현재 edge waypoint preview */
  edgeWaypointPreview?: EdgeWaypointPreview | null;
}

/**
 * YjsProvider 옵션.
 */
export interface YjsProviderOptions {
  /** 다이어그램 ID */
  diagramId: string;
  /** WebSocket 경로. 미지정 시 다이어그램 기본 경로를 사용 */
  websocketPath?: string;
  /** 일회용 WebSocket ticket을 발급받는 콜백 */
  getTicket: () => Promise<WsTicketIssueResponse>;
  /** WS 프로토콜 버전 (1: 레거시, 2: 리비전 포함 바이너리). 기본값 1 */
  protocolVersion?: 1 | 2;
}

/**
 * WebSocket 연결 상태.
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/** Presence 모드. */
export type PresenceMode = 'active' | 'degraded';

/** 웹소켓 티켓 발급 응답. */
export interface WsTicketIssueResponse {
  /** 일회용 ticket 문자열 */
  ticket: string;
  /** 사용자 ID (불변 식별자) */
  userId: string;
  /** presence 프로토콜 버전 (0이면 미지원) */
  presenceProtocolVersion: number;
}

/** Presence 참여자 정보. */
export interface PresenceParticipant {
  /** 사용자 ID */
  userId: string;
  /** 표시 이름 */
  displayName: string;
  /** 입장 순서 */
  joinSeq: number;
}

/** Presence snapshot 메시지 payload. */
export interface PresenceSnapshotPayload {
  /** 다이어그램 ID */
  diagramId: string;
  /** room 세대 식별자 */
  roomEpoch: string;
  /** room 단위 버전 */
  presenceVersion: number;
  /** 참여자 목록 */
  participants: PresenceParticipant[];
  /** self 포함 총원 */
  totalIncludingSelf: number;
}

/** Presence peer joined 메시지 payload. */
export interface PresencePeerJoinedPayload {
  /** 다이어그램 ID */
  diagramId: string;
  /** room 세대 식별자 */
  roomEpoch: string;
  /** room 단위 버전 */
  presenceVersion: number;
  /** 신규 입장 참여자 */
  participant: PresenceParticipant;
}

/** Presence peer left 메시지 payload. */
export interface PresencePeerLeftPayload {
  /** 다이어그램 ID */
  diagramId: string;
  /** room 세대 식별자 */
  roomEpoch: string;
  /** room 단위 버전 */
  presenceVersion: number;
  /** 완전 퇴장 사용자 ID */
  userId: string;
}

/** 문서 변경 요약 read model. */
export interface DocumentChangeSummary {
  /** 현재 문서 revision */
  revision: string;
  /** 변경 원천 */
  origin: 'local' | 'remote' | 'bootstrap' | 'system';
  /** 영향 범위 요약 */
  affectedScopes: Array<{
    kind: string;
    id: string;
    mode: ScopeLockMode;
  }>;
  /** 마지막 갱신 시각 */
  changedAt: number;
}
