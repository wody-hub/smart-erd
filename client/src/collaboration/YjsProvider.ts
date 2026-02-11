import * as Y from 'yjs';
import { WS_MSG_TYPE, WS_RECONNECT } from '@/constants/ws';
import type { AwarenessState, ConnectionStatus, YjsProviderOptions } from '@/types/collaboration';

/**
 * Raw WebSocket 기반 Yjs sync provider.
 *
 * 서버와 바이너리 프로토콜로 Y.Doc update를 주고받는다.
 * 서버는 relay만 담당하며, 클라이언트 간 sync protocol로 상태를 동기화한다.
 * Awareness(커서/선택 상태) 메시지도 같은 연결로 전송한다.
 *
 * @example
 * ```ts
 * const provider = new YjsProvider(ydoc, {
 *   diagramId: '123',
 *   getTicket: () => requestWsTicket('123'),
 * });
 * provider.connect();
 * // ...
 * provider.destroy();
 * ```
 */
export class YjsProvider {
  /** Yjs 문서 */
  readonly doc: Y.Doc;

  /** WebSocket 인스턴스 */
  private ws: WebSocket | null = null;

  /** 연결 옵션 */
  private readonly options: YjsProviderOptions;

  /** 재연결 타이머 */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** 현재 재연결 대기 시간 */
  private reconnectDelay: number = WS_RECONNECT.INITIAL_DELAY;

  /** 수동으로 연결을 끊었는지 여부 */
  private intentionalClose = false;

  /** Y.Doc update 핸들러 참조 (cleanup용) */
  private readonly updateHandler: (update: Uint8Array, origin: unknown) => void;

  /** 연결 상태 변경 콜백 */
  onConnectionStatusChange: ((status: ConnectionStatus) => void) | null = null;

  /** 개별 Awareness 수신 콜백 (clientId + state, state null이면 해당 클라이언트 제거) */
  onAwarenessReceived: ((clientId: number, state: AwarenessState | null) => void) | null = null;

  /** Peer left 콜백 (loginId 기반 커서 제거) */
  onPeerLeft: ((loginId: string) => void) | null = null;

  /** 로컬 Awareness 상태 */
  private localAwareness: AwarenessState | null = null;

  /** 고유 클라이언트 ID */
  readonly clientId: number;

  /** 초기 sync 완료 여부 */
  private synced = false;

  /**
   * YjsProvider를 생성한다.
   *
   * @param doc     동기화할 Y.Doc
   * @param options 연결 옵션 (diagramId, getTicket)
   */
  constructor(doc: Y.Doc, options: YjsProviderOptions) {
    this.doc = doc;
    this.options = options;
    this.clientId = doc.clientID;

    // Y.Doc update 이벤트 → 'remote' origin이 아닌 경우만 WebSocket 전송
    this.updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return;
      this.sendMessage(WS_MSG_TYPE.YJS_UPDATE, update);
    };

    this.doc.on('update', this.updateHandler);
  }

  /**
   * WebSocket 연결을 시작한다.
   */
  connect(): void {
    this.intentionalClose = false;
    void this.createWebSocket();
  }

  /**
   * WebSocket 연결을 종료하고 리소스를 정리한다.
   */
  destroy(): void {
    this.intentionalClose = true;
    this.doc.off('update', this.updateHandler);
    this.clearReconnectTimer();

    try {
      // WS 닫기 전 Awareness null 전송 (정상 종료 시 고스트 커서 방지)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const json = JSON.stringify({ clientId: this.clientId, state: null });
        const encoder = new TextEncoder();
        this.sendMessage(WS_MSG_TYPE.AWARENESS, encoder.encode(json));
        this.ws.close();
        this.ws = null;
      } else if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    } finally {
      this.emitConnectionStatus('disconnected');
    }
  }

  /**
   * 로컬 Awareness 상태를 설정하고 서버로 전송한다.
   *
   * @param state Awareness 상태
   */
  setLocalAwareness(state: AwarenessState): void {
    this.localAwareness = state;
    this.sendAwareness();
  }

  /**
   * WebSocket 인스턴스를 생성하고 이벤트를 바인딩한다.
   */
  private async createWebSocket(): Promise<void> {
    let ticket: string;
    try {
      ticket = await this.options.getTicket();
    } catch (e) {
      console.error('[YjsProvider] ticket 발급 실패:', e);
      this.emitConnectionStatus('disconnected');
      this.scheduleReconnect();
      return;
    }

    const serverUrl = this.buildWsUrl(ticket);
    this.emitConnectionStatus('connecting');

    this.ws = new WebSocket(serverUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.reconnectDelay = WS_RECONNECT.INITIAL_DELAY;
      this.emitConnectionStatus('connected');
      this.requestSnapshot();
      this.requestSync();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleMessage(new Uint8Array(event.data));
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.synced = false;
      this.emitConnectionStatus('disconnected');
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose가 자동으로 뒤따르므로 여기서는 별도 처리 불필요
    };
  }

  /**
   * 수신된 바이너리 메시지를 타입별로 처리한다.
   *
   * @param data 수신 데이터
   */
  private handleMessage(data: Uint8Array): void {
    if (data.length === 0) return;

    const messageType = data[0];
    const payload = data.subarray(1);

    switch (messageType) {
      case WS_MSG_TYPE.SYNC_STEP1: {
        // 상대방의 state vector 수신 → diff를 SYNC_STEP2로 응답
        const stateVector = payload;
        const diff = Y.encodeStateAsUpdate(this.doc, stateVector);
        this.sendMessage(WS_MSG_TYPE.SYNC_STEP2, diff);
        break;
      }
      case WS_MSG_TYPE.SYNC_STEP2:
      case WS_MSG_TYPE.YJS_UPDATE: {
        // diff 또는 update 수신 → Y.Doc에 적용
        try {
          Y.applyUpdate(this.doc, payload, 'remote');
        } catch (e) {
          console.error('[YjsProvider] Y.applyUpdate 실패 (sync/update):', e);
          this.reconnectAfterError();
          return;
        }
        if (messageType === WS_MSG_TYPE.SYNC_STEP2) {
          this.synced = true;
        }
        break;
      }
      case WS_MSG_TYPE.AWARENESS: {
        this.handleAwarenessMessage(payload);
        break;
      }
      case WS_MSG_TYPE.SNAPSHOT_RESPONSE: {
        // 서버 스냅샷 수신 → Y.Doc에 적용
        try {
          Y.applyUpdate(this.doc, payload, 'remote');
        } catch (e) {
          console.error('[YjsProvider] Y.applyUpdate 실패 (snapshot):', e);
          this.reconnectAfterError();
          return;
        }
        break;
      }
      case WS_MSG_TYPE.PEER_LEFT: {
        this.handlePeerLeftMessage(payload);
        break;
      }
    }
  }

  /**
   * 서버에 저장된 Y.Doc 스냅샷을 요청한다.
   * WebSocket 연결 시 sync 전에 호출하여 기존 상태를 복원한다.
   */
  private requestSnapshot(): void {
    this.sendMessage(WS_MSG_TYPE.SNAPSHOT_REQUEST, new Uint8Array(0));
  }

  /**
   * 초기 sync를 시작한다.
   * 자신의 state vector를 SYNC_STEP1로 전송하여 상대방에게 diff를 요청한다.
   */
  private requestSync(): void {
    const stateVector = Y.encodeStateVector(this.doc);
    this.sendMessage(WS_MSG_TYPE.SYNC_STEP1, stateVector);

    // Awareness 상태도 전송
    if (this.localAwareness) {
      this.sendAwareness();
    }
  }

  /**
   * 바이너리 메시지를 WebSocket으로 전송한다.
   *
   * @param type    메시지 타입 코드
   * @param payload 페이로드 데이터
   */
  private sendMessage(type: number, payload: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = new Uint8Array(payload.length + 1);
    message[0] = type;
    message.set(payload, 1);

    this.ws.send(message);
  }

  /**
   * Awareness 상태를 서버로 전송한다.
   */
  private sendAwareness(): void {
    if (!this.localAwareness) return;

    const json = JSON.stringify({
      clientId: this.clientId,
      state: this.localAwareness,
    });
    const encoder = new TextEncoder();
    this.sendMessage(WS_MSG_TYPE.AWARENESS, encoder.encode(json));
  }

  /**
   * 수신된 Awareness 메시지를 파싱하여 콜백으로 전달한다.
   * Provider는 상태를 보관하지 않고, Store가 SSOT로 관리한다.
   *
   * @param payload Awareness JSON 페이로드
   */
  private handleAwarenessMessage(payload: Uint8Array): void {
    try {
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(payload)) as {
        clientId: number;
        state: AwarenessState | null;
      };

      if (json.clientId === this.clientId) return;

      this.onAwarenessReceived?.(json.clientId, json.state);
    } catch (e) {
      console.debug('[YjsProvider] Awareness 메시지 파싱 실패:', e);
    }
  }

  /**
   * 수신된 Peer left 메시지를 처리한다.
   * 해당 loginId의 원격 커서를 제거한다.
   *
   * @param payload Peer left JSON 페이로드
   */
  private handlePeerLeftMessage(payload: Uint8Array): void {
    try {
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(payload)) as { loginId: string };

      this.onPeerLeft?.(json.loginId);
    } catch (e) {
      console.debug('[YjsProvider] Peer left 메시지 파싱 실패:', e);
    }
  }

  /**
   * Y.applyUpdate 실패 등 심각한 오류 시 WebSocket을 닫고 재연결을 시도한다.
   */
  private reconnectAfterError(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.synced = false;
    this.emitConnectionStatus('disconnected');
    this.scheduleReconnect();
  }

  /**
   * 지수 백오프로 재연결을 예약한다.
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      void this.createWebSocket();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * WS_RECONNECT.MULTIPLIER,
      WS_RECONNECT.MAX_DELAY,
    );
  }

  /**
   * 재연결 타이머를 해제한다.
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 현재 환경에 맞는 WebSocket URL을 생성한다.
   *
   * @param ticket 일회용 WebSocket ticket
   * @returns WebSocket URL
   */
  private buildWsUrl(ticket: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/diagram/${this.options.diagramId}?ticket=${ticket}`;
  }

  /**
   * 연결 상태 변경을 콜백으로 알린다.
   *
   * @param status 연결 상태
   */
  private emitConnectionStatus(status: ConnectionStatus): void {
    this.onConnectionStatusChange?.(status);
  }

  /**
   * 사전 인코딩된 Y.Doc 전체 상태를 서버에 컴팩션 요청으로 전송한다.
   * 호출 측에서 Y.encodeStateAsUpdate()를 한 번만 실행하여 이중 인코딩을 방지한다.
   * 서버는 기존 ydocSnapshot을 이 압축 데이터로 교체한다.
   *
   * @param encodedState Y.encodeStateAsUpdate()로 사전 인코딩된 바이트 배열
   */
  requestCompaction(encodedState: Uint8Array): void {
    this.sendMessage(WS_MSG_TYPE.COMPACTED_SNAPSHOT, encodedState);
  }

  /**
   * 현재 sync 완료 여부를 반환한다.
   *
   * @returns sync 완료 여부
   */
  isSynced(): boolean {
    return this.synced;
  }
}
