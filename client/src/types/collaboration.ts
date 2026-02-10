/**
 * 원격 사용자의 Awareness 상태.
 */
export interface AwarenessState {
  /** 사용자 정보 */
  user: {
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
}

/**
 * YjsProvider 옵션.
 */
export interface YjsProviderOptions {
  /** 다이어그램 ID */
  diagramId: string;
  /** JWT Access Token */
  token: string;
  /** WebSocket 서버 URL (기본: 자동 감지) */
  serverUrl?: string;
}

/**
 * WebSocket 연결 상태.
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
