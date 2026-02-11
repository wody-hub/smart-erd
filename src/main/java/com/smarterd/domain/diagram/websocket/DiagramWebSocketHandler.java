package com.smarterd.domain.diagram.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.config.WebSocketProperties;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import java.util.Arrays;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

/**
 * 다이어그램 실시간 협업 WebSocket 핸들러.
 *
 * <p>Yjs CRDT 바이너리 프로토콜을 기반으로 동작한다.
 * 서버는 Yjs 메시지를 해석하지 않고, 같은 방의 다른 클라이언트에 relay만 수행한다.
 * 클라이언트 간 직접 sync protocol로 상태를 동기화한다.</p>
 *
 * <p>메시지 프로토콜 (첫 바이트 = 타입 코드):
 * <ul>
 *   <li>{@code 0x01} — Yjs sync step 1 (state vector 요청)</li>
 *   <li>{@code 0x02} — Yjs sync step 2 (diff 응답)</li>
 *   <li>{@code 0x03} — Yjs update (실시간 변경)</li>
 *   <li>{@code 0x04} — Awareness update (커서/선택 상태)</li>
 *   <li>{@code 0x05} — Snapshot request (서버에 저장된 스냅샷 요청)</li>
 *   <li>{@code 0x06} — Snapshot response (서버 → 클라이언트 스냅샷 전송)</li>
 *   <li>{@code 0x07} — Peer left (서버 → 클라이언트, 사용자 퇴장 알림)</li>
 *   <li>{@code 0x08} — Compacted snapshot (클라이언트 → 서버, 스냅샷 교체 요청)</li>
 * </ul></p>
 */
@Component
@RequiredArgsConstructor
@SuppressWarnings("null")
public class DiagramWebSocketHandler extends BinaryWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(DiagramWebSocketHandler.class);

    /** Yjs sync step 1 (state vector 요청) */
    private static final byte MSG_SYNC_STEP1 = 0x01;

    /** Yjs sync step 2 (diff 응답) */
    private static final byte MSG_SYNC_STEP2 = 0x02;

    /** Yjs update (실시간 변경) */
    private static final byte MSG_YJS_UPDATE = 0x03;

    /** Awareness update (커서/선택 상태) */
    private static final byte MSG_AWARENESS = 0x04;

    /** Snapshot request (클라이언트 → 서버) */
    private static final byte MSG_SNAPSHOT_REQUEST = 0x05;

    /** Snapshot response (서버 → 클라이언트) */
    private static final byte MSG_SNAPSHOT_RESPONSE = 0x06;

    /** Peer left (서버 → 클라이언트, 사용자 퇴장 알림) */
    static final byte MSG_PEER_LEFT = 0x07;

    /** Compacted snapshot (클라이언트 → 서버, 스냅샷 교체 요청) */
    private static final byte MSG_COMPACTED_SNAPSHOT = 0x08;

    /** 세션 cleanup 완료 플래그 (attributes 키) — 중복 afterConnectionClosed 방지 */
    private static final String CLEANED_UP_ATTR = "ws.cleanedUp";

    /** WebSocket 설정 프로퍼티 */
    private final WebSocketProperties webSocketProperties;

    /** 방 관리자 */
    private final DiagramRoomManager roomManager;

    /** 스냅샷 저장 서비스 */
    private final DiagramSnapshotService snapshotService;

    /** JSON 파서 (Awareness 검증, PEER_LEFT 메시지 생성용) */
    private final ObjectMapper objectMapper;

    /**
     * WebSocket 연결 수립 후 호출된다.
     * 세션별 메시지 크기 제한을 설정하고, 해당 다이어그램 방에 입장시킨다.
     *
     * @param session WebSocket 세션
     */
    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        session.setBinaryMessageSizeLimit(webSocketProperties.getBinaryMessageSizeLimit());

        final var info = getSessionInfo(session);
        final var joined = roomManager.join(info.diagramId(), session, info.loginId());
        if (!joined) {
            try {
                session.close(CloseStatus.POLICY_VIOLATION);
            } catch (Exception e) {
                log.warn("방 입장 거부 후 세션 종료 실패", e);
            }
        }
    }

    /**
     * 바이너리 메시지 수신 시 호출된다.
     * 메시지 타입에 따라 브로드캐스트 또는 스냅샷 처리를 수행한다.
     *
     * @param session WebSocket 세션
     * @param message 수신된 바이너리 메시지
     */
    @Override
    protected void handleBinaryMessage(@NonNull WebSocketSession session, @NonNull BinaryMessage message) {
        final var info = getSessionInfo(session);

        // 세션 만료 체크
        if (info.isExpired()) {
            log.info("WebSocket 세션 만료 (세션 {}, loginId={})", session.getId(), info.loginId());
            try {
                session.close(CloseStatus.POLICY_VIOLATION);
            } catch (Exception e) {
                log.warn("만료 세션 종료 실패 (세션 {})", session.getId(), e);
            }
            return;
        }

        // Rate limit 검사
        if (!roomManager.checkRateLimit(session)) {
            log.warn("Rate limit 초과 (세션 {})", session.getId());
            return;
        }

        final var payload = message.getPayload().array();

        if (payload.length == 0) {
            return;
        }

        final var messageType = payload[0];

        switch (messageType) {
            case MSG_SYNC_STEP1, MSG_SYNC_STEP2 -> roomManager.broadcast(info.diagramId(), session, message);
            case MSG_AWARENESS -> broadcastIfAwarenessValid(info, session, message, payload);
            case MSG_YJS_UPDATE -> {
                roomManager.broadcast(info.diagramId(), session, message);
                // 타입 바이트(0x03) 제외한 순수 Yjs update만 누적
                final var accepted = roomManager.appendUpdate(
                    info.diagramId(),
                    Arrays.copyOfRange(payload, 1, payload.length)
                );
                if (!accepted) {
                    log.warn(
                        "누적 update 크기 초과로 저장 거부 (diagramId={}, 세션 {})",
                        info.diagramId(),
                        session.getId()
                    );
                }
            }
            case MSG_SNAPSHOT_REQUEST -> sendSnapshotToSession(session, info.diagramId());
            case MSG_COMPACTED_SNAPSHOT -> handleCompaction(info.diagramId(), payload);
            default -> {
                if (log.isDebugEnabled()) {
                    log.debug("알 수 없는 메시지 타입: 0x{}", String.format("%02x", messageType));
                }
            }
        }
    }

    /**
     * WebSocket 연결 종료 후 호출된다.
     * 세션을 방에서 퇴장시키고, 마지막 사용자인 경우 누적 update를 DB에 저장한다.
     * 다른 사용자에게 퇴장 알림(PEER_LEFT)을 브로드캐스트한다.
     *
     * @param session WebSocket 세션
     * @param status  종료 상태
     */
    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        // handleTransportError의 방어적 호출로 중복 실행 방지
        if (session.getAttributes().put(CLEANED_UP_ATTR, Boolean.TRUE) != null) {
            return;
        }

        final var info = getSessionInfo(session);
        roomManager.cleanupRateLimit(session);

        // PEER_LEFT 메시지 브로드캐스트 (퇴장 전에 전송)
        broadcastPeerLeft(info.diagramId(), session, info.loginId());

        // leave: 방이 비면 원자적으로 누적 update를 drain + 인메모리 리소스 정리
        final var result = roomManager.leave(info.diagramId(), session, info.loginId());

        if (result.roomEmpty()) {
            // 마지막 사용자 퇴장 → drain된 update를 DB에 저장
            if (result.drainedUpdates().length > 0) {
                synchronized (roomManager.getFlushLock(info.diagramId())) {
                    snapshotService.saveSnapshotWithUpdates(info.diagramId(), result.drainedUpdates());
                }
            }
            // flush 완료 후 flush 락 제거
            roomManager.removeFlushLock(info.diagramId());
        }
    }

    /**
     * WebSocket 전송 오류 시 호출된다.
     *
     * @param session   WebSocket 세션
     * @param exception 발생한 예외
     */
    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        log.error("WebSocket 전송 오류 (세션 {})", session.getId(), exception);

        // 방어적 세션 정리: 세션이 이미 닫혀있으면 afterConnectionClosed가 호출되지 않을 수 있음
        if (!session.isOpen()) {
            try {
                afterConnectionClosed(session, CloseStatus.SERVER_ERROR);
            } catch (Exception e) {
                log.warn("전송 오류 후 방어적 세션 정리 실패 (세션 {})", session.getId(), e);
            }
        }
    }

    /**
     * Awareness 메시지를 검증 후 같은 방에 브로드캐스트한다.
     *
     * @param info    세션 메타데이터
     * @param session WebSocket 세션
     * @param message 수신된 바이너리 메시지
     * @param payload 메시지 payload 바이트 배열
     */
    private void broadcastIfAwarenessValid(
        WebSocketSessionInfo info,
        WebSocketSession session,
        BinaryMessage message,
        byte[] payload
    ) {
        if (isAwarenessValid(payload, info.loginId())) {
            roomManager.broadcast(info.diagramId(), session, message);
        }
    }

    /**
     * Awareness 메시지의 loginId가 세션의 loginId와 일치하는지 검증한다.
     *
     * @param payload 전체 메시지 payload (타입 바이트 포함)
     * @param expectedLoginId 세션에서 인증된 loginId
     * @return 검증 통과 여부
     */
    private boolean isAwarenessValid(byte[] payload, String expectedLoginId) {
        try {
            final var jsonBytes = Arrays.copyOfRange(payload, 1, payload.length);
            final var tree = objectMapper.readTree(jsonBytes);
            final var stateNode = tree.path("state");
            if (stateNode.isMissingNode() || stateNode.isNull()) {
                // Awareness null 전송 (정상 종료 시): 검증 통과
                return true;
            }
            final var loginIdNode = stateNode.path("user").path("loginId");
            return loginIdNode.isTextual() && loginIdNode.textValue().equals(expectedLoginId);
        } catch (Exception e) {
            log.debug("Awareness 검증 실패", e);
            return false;
        }
    }

    /**
     * PEER_LEFT 메시지를 같은 방의 다른 세션에 브로드캐스트한다.
     *
     * @param diagramId 다이어그램 ID
     * @param sender    퇴장하는 세션
     * @param loginId   퇴장하는 사용자의 loginId
     */
    private void broadcastPeerLeft(Long diagramId, WebSocketSession sender, String loginId) {
        try {
            final var jsonBytes = objectMapper.writeValueAsBytes(Map.of("loginId", loginId));
            final var payload = new byte[jsonBytes.length + 1];
            payload[0] = MSG_PEER_LEFT;
            System.arraycopy(jsonBytes, 0, payload, 1, jsonBytes.length);
            roomManager.broadcast(diagramId, sender, new BinaryMessage(payload));
        } catch (Exception e) {
            log.warn("PEER_LEFT 메시지 생성 실패 (loginId={})", loginId, e);
        }
    }

    /**
     * 클라이언트로부터 컴팩션된 스냅샷을 수신하여 교체한다.
     *
     * <p>이중 락으로 동시성을 보호한다:
     * <ul>
     *   <li>{@code flushLock} — {@code @Scheduled flushDirtySnapshots()}와의 동시 drain 방지</li>
     *   <li>{@code sessions} 락 ({@link DiagramRoomManager#drainIfAlone} 내부) — {@code join()}과의 TOCTOU 레이스 방지</li>
     * </ul>
     * {@code flushLock}이 외부 락이므로 drain부터 {@code restoreUpdates()}까지의 전체 흐름이 보호된다.</p>
     *
     * @param diagramId 다이어그램 ID
     * @param payload   전체 메시지 payload (타입 바이트 포함)
     */
    private void handleCompaction(Long diagramId, byte[] payload) {
        final var compactedUpdate = Arrays.copyOfRange(payload, 1, payload.length);
        if (compactedUpdate.length == 0) {
            return;
        }

        // flushLock: @Scheduled flush의 drainAndMergeUpdates()와 동시 drain 방지
        synchronized (roomManager.getFlushLock(diagramId)) {
            // 원자적으로 단독 접속 확인 + 누적 update drain (sessions 락 내부에서 수행)
            // drainIfAlone()이 null을 반환하면 단독 접속이 아니거나 방이 없음
            final var mergedUpdates = roomManager.drainIfAlone(diagramId);
            if (mergedUpdates == null) {
                log.warn("컴팩션 거부: 단독 접속 아님 (diagramId={})", diagramId);
                return;
            }

            try {
                final var success = snapshotService.replaceSnapshot(diagramId, compactedUpdate);
                if (!success) {
                    // 크기 검증 실패 또는 다이어그램 미존재: drain된 update 복원
                    roomManager.restoreUpdates(diagramId, mergedUpdates);
                }
            } catch (Exception e) {
                roomManager.restoreUpdates(diagramId, mergedUpdates);
                log.error("컴팩션 실패, drain된 update 복원 (diagramId={})", diagramId, e);
            }
        }
    }

    /**
     * 서버에 저장된 스냅샷을 특정 세션에 전송한다.
     *
     * @param session   대상 세션
     * @param diagramId 다이어그램 ID
     */
    private void sendSnapshotToSession(WebSocketSession session, Long diagramId) {
        try {
            final var snapshot = snapshotService.loadSnapshot(diagramId);
            if (snapshot.length == 0) {
                return;
            }

            // length-prefixed 포맷을 디코딩하여 개별 Yjs update를 각각 전송
            final var updates = YjsUpdateFormat.decode(snapshot);
            final var lock = roomManager.getSessionLock(session);
            synchronized (lock) {
                for (final var update : updates) {
                    final var responsePayload = new byte[update.length + 1];
                    responsePayload[0] = MSG_SNAPSHOT_RESPONSE;
                    System.arraycopy(update, 0, responsePayload, 1, update.length);
                    session.sendMessage(new BinaryMessage(responsePayload));
                }
            }
        } catch (Exception e) {
            log.error("스냅샷 전송 실패 (다이어그램 {})", diagramId, e);
        }
    }

    /**
     * 세션 attributes에서 WebSocketSessionInfo를 추출한다.
     *
     * @param session WebSocket 세션
     * @return 세션 메타데이터
     */
    private WebSocketSessionInfo getSessionInfo(WebSocketSession session) {
        return (WebSocketSessionInfo) session.getAttributes().get(WebSocketSessionInfo.SESSION_ATTR_KEY);
    }
}
