package com.smarterd.domain.diagram.websocket.relay;

/**
 * 다이어그램 협업 WebSocket 바이너리 프로토콜의 메시지 타입 상수 모음.
 *
 * <p>모든 메시지는 첫 1바이트를 타입으로 사용하며, 나머지 바이트는 타입별 payload로 해석한다.</p>
 */
public final class DiagramMessageTypes {

    /** Yjs sync step 1 (state vector 요청) */
    public static final byte MSG_SYNC_STEP1 = 0x01;

    /** Yjs sync step 2 (diff 응답) */
    public static final byte MSG_SYNC_STEP2 = 0x02;

    /** Yjs update (실시간 변경) */
    public static final byte MSG_YJS_UPDATE = 0x03;

    /** Awareness update (커서/선택 상태) */
    public static final byte MSG_AWARENESS = 0x04;

    /** Snapshot request (클라이언트 → 서버) */
    public static final byte MSG_SNAPSHOT_REQUEST = 0x05;

    /** Snapshot response (서버 → 클라이언트) */
    public static final byte MSG_SNAPSHOT_RESPONSE = 0x06;

    /** Legacy peer left (서버 → 클라이언트, loginId 기반) */
    public static final byte MSG_PEER_LEFT_LEGACY = 0x07;

    /** Compacted snapshot (클라이언트 → 서버, 스냅샷 교체 요청) */
    public static final byte MSG_COMPACTED_SNAPSHOT = 0x08;

    /** Presence snapshot (서버 → 클라이언트) */
    public static final byte MSG_PRESENCE_SNAPSHOT = 0x09;

    /** Presence peer joined (서버 → 클라이언트) */
    public static final byte MSG_PEER_JOINED = 0x0A;

    /** Presence peer left (서버 → 클라이언트, userId 기반) */
    public static final byte MSG_PEER_LEFT = 0x0B;

    /** Presence snapshot 재요청 (클라이언트 → 서버) */
    public static final byte MSG_PRESENCE_SNAPSHOT_REQUEST = 0x0C;

    /** Snapshot request v2 (클라이언트 → 서버, single-payload handoff) */
    public static final byte MSG_SNAPSHOT_REQUEST_V2 = 0x0D;

    /** Snapshot response v2 (서버 → 클라이언트, raw snapshot blob) */
    public static final byte MSG_SNAPSHOT_RESPONSE_V2 = 0x0E;

    /**
     * 유틸리티 클래스 인스턴스화 방지.
     */
    private DiagramMessageTypes() {}
}
