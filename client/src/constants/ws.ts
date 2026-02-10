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
  PEER_LEFT: 0x07,
} as const;

/** Awareness 커서 색상 팔레트 (6색) */
export const CURSOR_COLORS = [
  'hsl(0, 80%, 60%)',
  'hsl(210, 80%, 60%)',
  'hsl(120, 60%, 50%)',
  'hsl(45, 90%, 55%)',
  'hsl(280, 70%, 60%)',
  'hsl(180, 60%, 50%)',
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
