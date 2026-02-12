/**
 * WebSocket 메시지 타입 코드 상수.
 *
 * 서버와 클라이언트 간 바이너리 프로토콜의 첫 바이트에 사용되는 타입 코드를 정의한다.
 * 백엔드 DiagramWebSocketHandler의 타입 코드와 일치해야 한다.
 */
export const WS_MSG_TYPE = {
  /** Yjs sync step 1 (state vector 요청) */
  SYNC_STEP1: 0x01,
  /** Yjs sync step 2 (diff 응답) */
  SYNC_STEP2: 0x02,
  /** Yjs update (실시간 변경) */
  YJS_UPDATE: 0x03,
  /** Awareness update (커서/선택 상태) */
  AWARENESS: 0x04,
  /** Snapshot request (클라이언트 → 서버) */
  SNAPSHOT_REQUEST: 0x05,
  /** Snapshot response (서버 → 클라이언트) */
  SNAPSHOT_RESPONSE: 0x06,
  /** Peer left (서버 → 클라이언트, 사용자 퇴장 알림) */
  PEER_LEFT_LEGACY: 0x07,
  /** Compacted snapshot (클라이언트 → 서버, 스냅샷 교체 요청) */
  COMPACTED_SNAPSHOT: 0x08,
  /** Presence snapshot (서버 → 클라이언트) */
  PRESENCE_SNAPSHOT: 0x09,
  /** Presence peer joined (서버 → 클라이언트) */
  PEER_JOINED: 0x0a,
  /** Presence peer left (서버 → 클라이언트, userId 기반) */
  PEER_LEFT: 0x0b,
  /** Presence snapshot 재요청 (클라이언트 → 서버) */
  PRESENCE_SNAPSHOT_REQUEST: 0x0c,
} as const;

/** Awareness 커서 색상 팔레트 (6색) — CSS Variable 기반 디자인 토큰 */
export const CURSOR_COLORS = [
  'hsl(var(--cursor-color-1))',
  'hsl(var(--cursor-color-2))',
  'hsl(var(--cursor-color-3))',
  'hsl(var(--cursor-color-4))',
  'hsl(var(--cursor-color-5))',
  'hsl(var(--cursor-color-6))',
] as const;

/** WebSocket 재연결 설정 */
export const WS_RECONNECT = {
  /** 초기 재연결 대기 시간 (ms) */
  INITIAL_DELAY: 1000,
  /** 최대 재연결 대기 시간 (ms) */
  MAX_DELAY: 30000,
  /** 재연결 배수 (exponential backoff) */
  MULTIPLIER: 2,
} as const;

/** Presence bootstrap timeout (ms) */
export const WS_PRESENCE = {
  BOOTSTRAP_TIMEOUT_MS: 3000,
} as const;
