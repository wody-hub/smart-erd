/** REST 헤더와 WebSocket 협상이 공유하는 편집 프로토콜 버전. */
export const CLIENT_PROTOCOL_VERSION = 3;
/** REST 클라이언트 프로토콜 헤더 이름. */
export const CLIENT_PROTOCOL_HEADER = 'X-Smart-Erd-Client-Protocol';
/** 프로토콜 정책 거부 사유. */
export const PROTOCOL_TOO_OLD = 'protocol-too-old';
/** 편집 프로토콜 업그레이드 필요 HTTP 상태. */
export const PROTOCOL_UPGRADE_REQUIRED = 426;
