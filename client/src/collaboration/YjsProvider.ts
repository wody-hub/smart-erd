import * as Y from 'yjs';
import { CANVAS_HISTORY_ORIGIN, DRAG_TRANSACTION_ORIGIN } from '@/constants/canvas-history';
import { getWsBaseUrl } from '@/lib/platform';
import { WS_MSG_TYPE, WS_PRESENCE, WS_RECONNECT } from '@/constants/ws';
import type {
  AwarenessState,
  ConnectionStatus,
  PresenceMode,
  PresencePeerJoinedPayload,
  PresencePeerLeftPayload,
  PresenceSnapshotPayload,
  YjsProviderOptions,
} from '@/types/collaboration';

/** snapshot 재요청 rate limit (분당 최대 횟수) */
const MAX_SNAPSHOT_REQUESTS_PER_MINUTE = 6;

/**
 * Raw WebSocket 기반 Yjs sync provider.
 *
 * 서버와 바이너리 프로토콜로 Y.Doc update를 주고받는다.
 * 서버는 relay만 담당하며, 클라이언트 간 sync protocol로 상태를 동기화한다.
 * Awareness(커서/선택 상태) 메시지도 같은 연결로 전송한다.
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

  /** presence bootstrap 타이머 */
  private presenceBootstrapTimer: ReturnType<typeof setTimeout> | null = null;

  /** 현재 재연결 대기 시간 */
  private reconnectDelay: number = WS_RECONNECT.INITIAL_DELAY;

  /** 수동으로 연결을 끊었는지 여부 */
  private intentionalClose = false;
  /** destroy 이후 인스턴스 재사용 차단 플래그 */
  private destroyed = false;

  /** Y.Doc update 핸들러 참조 (cleanup용) */
  private readonly updateHandler: (update: Uint8Array, origin: unknown) => void;

  /** 연결 상태 변경 콜백 */
  onConnectionStatusChange: ((status: ConnectionStatus) => void) | null = null;

  /** presence 모드 변경 콜백 */
  onPresenceModeChange: ((mode: PresenceMode) => void) | null = null;

  /** ticket 해석 후 현재 사용자 userId 확정 콜백 */
  onIdentityResolved: ((userId: string) => void) | null = null;

  /** 개별 Awareness 수신 콜백 (clientId + state, state null이면 해당 클라이언트 제거) */
  onAwarenessReceived: ((clientId: number, state: AwarenessState | null) => void) | null = null;

  /** legacy peer-left 콜백 (loginId 기반) */
  onPeerLeft: ((loginId: string) => void) | null = null;

  /** presence snapshot 수신 콜백 */
  onPresenceSnapshot: ((payload: PresenceSnapshotPayload) => void) | null = null;

  /** presence peer joined 수신 콜백 */
  onPresencePeerJoined: ((payload: PresencePeerJoinedPayload) => void) | null = null;

  /** presence peer left 수신 콜백 */
  onPresencePeerLeft: ((payload: PresencePeerLeftPayload) => void) | null = null;

  /** 로컬 Awareness 상태 */
  private localAwareness: AwarenessState | null = null;

  /** 사용자 ID (불변 식별자) */
  private selfUserId: string | null = null;

  /** presence 프로토콜 버전 (0이면 미지원) */
  private presenceProtocolVersion = 0;

  /** 마지막 room epoch */
  private lastRoomEpoch: string | null = null;

  /** 마지막 presence version */
  private lastPresenceVersion = 0;

  /** snapshot 재요청 타임스탬프 (ms) */
  private snapshotRequestTimestamps: number[] = [];

  /** 고유 클라이언트 ID */
  readonly clientId: number;

  /** 초기 sync 완료 여부 */
  private synced = false;

  /** 현재 presence 모드 */
  private presenceMode: PresenceMode = 'active';

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

    // Y.Doc update 이벤트 -> 'remote' origin이 아닌 경우만 WebSocket 전송
    this.updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote' || origin === CANVAS_HISTORY_ORIGIN.SYSTEM_DICTIONARY_RECONCILE) {
        return;
      }
      const outboundUpdate =
        origin === DRAG_TRANSACTION_ORIGIN ? Y.encodeStateAsUpdate(this.doc) : update;
      this.sendMessage(WS_MSG_TYPE.YJS_UPDATE, outboundUpdate);
    };

    this.doc.on('update', this.updateHandler);
  }

  /** 사용자 ID를 반환한다. */
  get userId(): string | null {
    return this.selfUserId;
  }

  /**
   * WebSocket 연결을 시작한다.
   */
  connect(): void {
    if (this.destroyed) {
      return;
    }
    this.intentionalClose = false;
    void this.createWebSocket();
  }

  /**
   * WebSocket 연결을 종료하고 리소스를 정리한다.
   */
  destroy(): void {
    this.intentionalClose = true;
    this.destroyed = true;
    this.doc.off('update', this.updateHandler);
    this.clearReconnectTimer();
    this.clearPresenceBootstrapTimer();

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
      this.emitPresenceMode('active');
    }
  }

  /**
   * 로컬 Awareness 상태를 설정하고 서버로 전송한다.
   *
   * @param state Awareness 상태
   */
  setLocalAwareness(state: AwarenessState): void {
    const mergedUser = {
      ...state.user,
      userId: state.user.userId ?? this.selfUserId,
    };
    this.localAwareness = {
      ...state,
      user: mergedUser,
    };
    this.sendAwareness();
  }

  /**
   * WebSocket 인스턴스를 생성하고 이벤트를 바인딩한다.
   */
  private async createWebSocket(): Promise<void> {
    if (this.destroyed || this.intentionalClose) {
      return;
    }

    let ticketData;
    try {
      ticketData = await this.options.getTicket();
    } catch (e) {
      if (this.destroyed || this.intentionalClose) {
        return;
      }
      console.error('[YjsProvider] ticket 발급 실패:', e);
      this.emitConnectionStatus('disconnected');
      this.scheduleReconnect();
      return;
    }

    if (this.destroyed || this.intentionalClose) {
      return;
    }

    this.selfUserId = ticketData.userId;
    this.presenceProtocolVersion = ticketData.presenceProtocolVersion ?? 0;
    this.onIdentityResolved?.(ticketData.userId);

    // 티켓 응답 수신 후 userId를 알게 되므로, 기존 로컬 awareness에 병합한다.
    if (this.localAwareness && !this.localAwareness.user.userId) {
      this.localAwareness = {
        ...this.localAwareness,
        user: {
          ...this.localAwareness.user,
          userId: this.selfUserId,
        },
      };
    }

    const serverUrl = this.buildWsUrl(ticketData.ticket);
    this.emitConnectionStatus('connecting');

    this.ws = new WebSocket(serverUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      if (this.destroyed || this.intentionalClose) {
        this.ws?.close();
        this.ws = null;
        return;
      }
      this.reconnectDelay = WS_RECONNECT.INITIAL_DELAY;
      this.lastRoomEpoch = null;
      this.lastPresenceVersion = 0;
      this.snapshotRequestTimestamps = [];
      this.emitConnectionStatus('connected');

      if (this.presenceProtocolVersion >= 1) {
        this.startPresenceBootstrapTimer();
      } else {
        this.emitPresenceMode('degraded');
      }

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
      this.clearPresenceBootstrapTimer();
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
        // 상대방의 state vector 수신 -> diff를 SYNC_STEP2로 응답
        const stateVector = payload;
        const diff = Y.encodeStateAsUpdate(this.doc, stateVector);
        this.sendMessage(WS_MSG_TYPE.SYNC_STEP2, diff);
        break;
      }
      case WS_MSG_TYPE.SYNC_STEP2:
      case WS_MSG_TYPE.YJS_UPDATE: {
        // diff 또는 update 수신 -> Y.Doc에 적용
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
        // 서버 스냅샷 수신 -> Y.Doc에 적용
        try {
          Y.applyUpdate(this.doc, payload, 'remote');
        } catch (e) {
          console.error('[YjsProvider] Y.applyUpdate 실패 (snapshot):', e);
          this.reconnectAfterError();
          return;
        }
        break;
      }
      case WS_MSG_TYPE.SNAPSHOT_RESPONSE_V2: {
        try {
          Y.applyUpdate(this.doc, this.mergeSnapshotPayload(payload), 'remote');
        } catch (e) {
          console.error('[YjsProvider] Y.applyUpdate 실패 (snapshot v2):', e);
          this.reconnectAfterError();
          return;
        }
        break;
      }
      case WS_MSG_TYPE.PRESENCE_SNAPSHOT: {
        this.handlePresenceSnapshot(payload);
        break;
      }
      case WS_MSG_TYPE.PEER_JOINED: {
        this.handlePresencePeerJoined(payload);
        break;
      }
      case WS_MSG_TYPE.PEER_LEFT: {
        this.handlePresencePeerLeft(payload);
        break;
      }
      case WS_MSG_TYPE.PEER_LEFT_LEGACY: {
        this.handleLegacyPeerLeftMessage(payload);
        break;
      }
    }
  }

  /**
   * 서버에 저장된 Y.Doc 스냅샷을 요청한다.
   * WebSocket 연결 시 sync 전에 호출하여 기존 상태를 복원한다.
   */
  private requestSnapshot(): void {
    this.sendMessage(WS_MSG_TYPE.SNAPSHOT_REQUEST_V2, new Uint8Array(0));
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
   * raw snapshot blob(v2)을 단일 update로 병합한다.
   *
   * length-prefixed 포맷은 개별 update들을 파싱해 `Y.mergeUpdates()`로 합치고,
   * 레거시 raw update 포맷은 그대로 반환한다.
   *
   * @param payload 서버가 전달한 raw snapshot blob
   * @returns 단일 Yjs update
   */
  private mergeSnapshotPayload(payload: Uint8Array): Uint8Array {
    const updates = this.decodeSnapshotPayload(payload);
    if (updates.length <= 1) {
      return updates[0] ?? payload;
    }
    return Y.mergeUpdates(updates);
  }

  /**
   * raw snapshot blob을 update 배열로 디코딩한다.
   *
   * 서버 저장 포맷은 `YLPF` magic header 기반 length-prefixed 형식이며,
   * 레거시 포맷은 단일 raw update를 그대로 사용한다.
   *
   * @param payload 서버가 전달한 raw snapshot blob
   * @returns update 배열
   */
  private decodeSnapshotPayload(payload: Uint8Array): Uint8Array[] {
    if (payload.length === 0) {
      return [];
    }

    const magic = [0x59, 0x4c, 0x50, 0x46];
    const hasMagic =
      payload.length >= magic.length && magic.every((value, index) => payload[index] === value);
    if (!hasMagic) {
      return [payload];
    }

    const updates: Uint8Array[] = [];
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    let offset = magic.length;
    while (offset + 4 <= payload.length) {
      const length = view.getInt32(offset, false);
      offset += 4;
      if (length <= 0 || offset + length > payload.length) {
        break;
      }
      updates.push(payload.slice(offset, offset + length));
      offset += length;
    }
    return updates;
  }

  /**
   * Presence snapshot 재요청을 전송한다.
   * capability 미지원 또는 요청 rate limit 초과 시 전송하지 않는다.
   */
  private requestPresenceSnapshot(): void {
    if (this.presenceProtocolVersion < 1) {
      return;
    }

    const now = Date.now();
    this.snapshotRequestTimestamps = this.snapshotRequestTimestamps.filter(
      (ts) => now - ts < 60000,
    );
    if (this.snapshotRequestTimestamps.length >= MAX_SNAPSHOT_REQUESTS_PER_MINUTE) {
      return;
    }

    this.snapshotRequestTimestamps.push(now);
    this.sendMessage(WS_MSG_TYPE.PRESENCE_SNAPSHOT_REQUEST, new Uint8Array(0));
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
   * Presence snapshot 메시지를 처리한다.
   */
  private handlePresenceSnapshot(payload: Uint8Array): void {
    try {
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(payload)) as PresenceSnapshotPayload;

      const epochChanged = this.lastRoomEpoch !== json.roomEpoch;
      if (epochChanged || json.presenceVersion > this.lastPresenceVersion) {
        this.lastRoomEpoch = json.roomEpoch;
        this.lastPresenceVersion = json.presenceVersion;
        this.onPresenceSnapshot?.(json);
      }

      this.clearPresenceBootstrapTimer();
      this.emitPresenceMode('active');
    } catch (e) {
      console.debug('[YjsProvider] Presence snapshot 파싱 실패:', e);
    }
  }

  /**
   * Presence peer joined 메시지를 처리한다.
   */
  private handlePresencePeerJoined(payload: Uint8Array): void {
    try {
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(payload)) as PresencePeerJoinedPayload;

      if (!this.lastRoomEpoch) {
        this.requestPresenceSnapshot();
        return;
      }
      if (json.roomEpoch !== this.lastRoomEpoch) {
        return;
      }
      if (json.presenceVersion <= this.lastPresenceVersion) {
        return;
      }
      if (json.presenceVersion > this.lastPresenceVersion + 1) {
        this.requestPresenceSnapshot();
        return;
      }

      this.lastPresenceVersion = json.presenceVersion;
      this.onPresencePeerJoined?.(json);
    } catch (e) {
      console.debug('[YjsProvider] Presence peer joined 파싱 실패:', e);
    }
  }

  /**
   * Presence peer left 메시지를 처리한다.
   */
  private handlePresencePeerLeft(payload: Uint8Array): void {
    try {
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(payload)) as PresencePeerLeftPayload;

      if (!this.lastRoomEpoch) {
        this.requestPresenceSnapshot();
        return;
      }
      if (json.roomEpoch !== this.lastRoomEpoch) {
        return;
      }
      if (json.presenceVersion <= this.lastPresenceVersion) {
        return;
      }
      if (json.presenceVersion > this.lastPresenceVersion + 1) {
        this.requestPresenceSnapshot();
        return;
      }

      this.lastPresenceVersion = json.presenceVersion;
      this.onPresencePeerLeft?.(json);
    } catch (e) {
      console.debug('[YjsProvider] Presence peer left 파싱 실패:', e);
    }
  }

  /**
   * 수신된 Legacy peer-left 메시지를 처리한다.
   *
   * @param payload Legacy peer-left JSON 페이로드
   */
  private handleLegacyPeerLeftMessage(payload: Uint8Array): void {
    try {
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(payload)) as { loginId: string };
      this.onPeerLeft?.(json.loginId);
    } catch (e) {
      console.debug('[YjsProvider] Legacy peer left 메시지 파싱 실패:', e);
    }
  }

  /**
   * presence bootstrap 타이머를 시작한다.
   */
  private startPresenceBootstrapTimer(): void {
    this.clearPresenceBootstrapTimer();
    this.presenceBootstrapTimer = setTimeout(() => {
      this.emitPresenceMode('degraded');
    }, WS_PRESENCE.BOOTSTRAP_TIMEOUT_MS);
  }

  /** presence bootstrap 타이머를 해제한다. */
  private clearPresenceBootstrapTimer(): void {
    if (this.presenceBootstrapTimer) {
      clearTimeout(this.presenceBootstrapTimer);
      this.presenceBootstrapTimer = null;
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
    this.clearPresenceBootstrapTimer();
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
    return `${getWsBaseUrl()}/ws/diagram/${this.options.diagramId}?ticket=${encodeURIComponent(ticket)}`;
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
   * presence 모드 변경을 콜백으로 알린다.
   *
   * @param mode presence 모드
   */
  private emitPresenceMode(mode: PresenceMode): void {
    if (this.presenceMode === mode) {
      return;
    }
    this.presenceMode = mode;
    this.onPresenceModeChange?.(mode);
  }

  /**
   * 사전 인코딩된 Y.Doc 전체 상태를 서버에 컴팩션 요청으로 전송한다.
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
