package com.smarterd.domain.diagram.websocket;

import com.smarterd.config.WebSocketProperties;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import jakarta.annotation.PostConstruct;
import java.nio.channels.ClosedChannelException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
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
 * <p>메시지 타입별 처리 로직은 {@link DiagramMessageHandler} 구현체로 위임하고,
 * 본 클래스는 연결 수명주기와 공통 예외/정리 흐름을 담당한다.</p>
 */
@Component
@RequiredArgsConstructor
public class DiagramWebSocketHandler extends BinaryWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(DiagramWebSocketHandler.class);

    /** 세션 cleanup 완료 플래그 (attributes 키) — 중복 afterConnectionClosed 방지 */
    private static final String CLEANED_UP_ATTR = "ws.cleanedUp";

    /** WebSocket 설정 프로퍼티 */
    private final WebSocketProperties webSocketProperties;

    /** 방 관리자 */
    private final DiagramRoomManager roomManager;

    /** 스냅샷 저장 서비스 */
    private final DiagramSnapshotService snapshotService;

    /** 메시지 전송 유틸 */
    private final DiagramMessageSender messageSender;

    /** presence 알림 전송 유틸 */
    private final DiagramPresenceNotifier presenceNotifier;

    /** 타입별 메시지 핸들러 */
    private final List<DiagramMessageHandler> messageHandlers;

    /** 메시지 타입 디스패치 맵 */
    private Map<Byte, DiagramMessageHandler> messageHandlerMap = Map.of();

    /** 클라이언트 -> 서버 inbound 메시지 타입 집합 */
    private static final Set<Byte> REQUIRED_INBOUND_MESSAGE_TYPES = Set.of(
        DiagramMessageTypes.MSG_SYNC_STEP1,
        DiagramMessageTypes.MSG_SYNC_STEP2,
        DiagramMessageTypes.MSG_YJS_UPDATE,
        DiagramMessageTypes.MSG_AWARENESS,
        DiagramMessageTypes.MSG_SNAPSHOT_REQUEST,
        DiagramMessageTypes.MSG_COMPACTED_SNAPSHOT,
        DiagramMessageTypes.MSG_PRESENCE_SNAPSHOT_REQUEST
    );

    /**
     * 등록된 타입별 핸들러 목록으로 디스패치 맵을 초기화한다.
     *
     * <p>동일 타입이 두 번 이상 등록되면 서버 시작 시점에 예외를 던져 설정 오류를 조기에 탐지한다.</p>
     *
     * @throws IllegalStateException 동일 메시지 타입이 중복 등록된 경우
     */
    @PostConstruct
    void initHandlerMap() {
        final var map = new HashMap<Byte, DiagramMessageHandler>();
        for (final var handler : messageHandlers) {
            for (final var type : handler.supportedTypes()) {
                if (!REQUIRED_INBOUND_MESSAGE_TYPES.contains(type)) {
                    throw new IllegalStateException(
                        "등록 불가 메시지 타입 감지: " + formatMessageTypes(Set.of(type)) + ", handler=" +
                            handler.getClass().getSimpleName()
                    );
                }
                final var previous = map.putIfAbsent(type, handler);
                if (previous != null) {
                    throw new IllegalStateException(
                        "중복 메시지 핸들러 등록: type=0x" +
                            String.format("%02x", Byte.toUnsignedInt(type)) +
                            ", first=" +
                            previous.getClass().getSimpleName() +
                            ", second=" +
                            handler.getClass().getSimpleName()
                    );
                }
            }
        }

        if (!map.keySet().containsAll(REQUIRED_INBOUND_MESSAGE_TYPES)) {
            final var missingTypes = REQUIRED_INBOUND_MESSAGE_TYPES
                .stream()
                .filter((type) -> !map.containsKey(type))
                .collect(Collectors.toSet());
            throw new IllegalStateException("필수 메시지 핸들러 누락: " + formatMessageTypes(missingTypes));
        }

        messageHandlerMap = Map.copyOf(map);
    }

    private String formatMessageTypes(Set<Byte> types) {
        return types
            .stream()
            .map((type) -> String.format("0x%02x", Byte.toUnsignedInt(type)))
            .sorted()
            .collect(Collectors.joining(", "));
    }

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
        final var joinResult = roomManager.join(info.diagramId(), session, info.userId(), info.userName());
        if (!joinResult.accepted()) {
            try {
                session.close(Objects.requireNonNull(CloseStatus.POLICY_VIOLATION));
            } catch (Exception e) {
                log.warn("방 입장 거부 후 세션 종료 실패", e);
            }
            return;
        }

        presenceNotifier.sendPresenceSnapshotToSession(session, info.diagramId(), joinResult.snapshot());

        if (joinResult.joinedParticipant() != null && joinResult.snapshot() != null) {
            presenceNotifier.broadcastPeerJoined(
                Objects.requireNonNull(info.diagramId()),
                session,
                joinResult.snapshot().roomEpoch(),
                joinResult.joinedPresenceVersion(),
                joinResult.joinedParticipant()
            );
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
                session.close(Objects.requireNonNull(CloseStatus.POLICY_VIOLATION));
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

        final var payload = messageSender.extractPayload(message);

        if (payload.length == 0) {
            return;
        }

        final var diagramId = Objects.requireNonNull(info.diagramId());
        final var context = new DiagramMessageContext(session, info, diagramId, message, payload);
        final var messageType = context.messageType();
        final var messageHandler = messageHandlerMap.get(messageType);

        if (messageHandler == null) {
            if (log.isDebugEnabled()) {
                log.debug("알 수 없는 메시지 타입: 0x{}", String.format("%02x", Byte.toUnsignedInt(messageType)));
            }
            return;
        }

        try {
            messageHandler.handle(context);
        } catch (Exception e) {
            log.error(
                "메시지 처리 실패 (type=0x{}, diagramId={}, session={})",
                String.format("%02x", Byte.toUnsignedInt(messageType)),
                diagramId,
                session.getId(),
                e
            );
        }
    }

    /**
     * WebSocket 연결 종료 후 호출된다.
     * 세션을 방에서 퇴장시키고, 마지막 사용자인 경우 누적 update를 DB에 저장한다.
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

        // leave: 방이 비면 원자적으로 누적 update를 drain + 인메모리 리소스 정리
        final var result = roomManager.leave(info.diagramId(), session, info.userId());

        // 사용자 완전 퇴장(1 -> 0)일 때만 presence peer-left 브로드캐스트
        if (result.leftUserId() != null && result.roomEpoch() != null) {
            presenceNotifier.broadcastPeerLeft(
                Objects.requireNonNull(info.diagramId()),
                session,
                result.roomEpoch(),
                result.leftPresenceVersion(),
                result.leftUserId()
            );
            // 구버전 클라이언트의 원격 커서 정리를 위해 loginId 기반 peer-left도 함께 전송
            presenceNotifier.broadcastPeerLeftLegacy(Objects.requireNonNull(info.diagramId()), session, info.loginId());
        }

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
     * <p>정상적인 채널 종료와 실제 오류를 구분해 로깅하고, 세션이 이미 닫힌 경우
     * 방어적으로 정리 루틴을 수행한다.</p>
     *
     * @param session   WebSocket 세션
     * @param exception 발생한 예외
     */
    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        // 서버 종료 시 Tomcat이 세션을 닫으면서 발생하는 ClosedChannelException은 정상 동작
        if (isClosedChannelException(exception)) {
            log.debug("WebSocket 채널 종료 (세션 {})", session.getId());
        } else {
            log.error("WebSocket 전송 오류 (세션 {})", session.getId(), exception);
        }

        // 방어적 세션 정리: 세션이 이미 닫혀있으면 afterConnectionClosed가 호출되지 않을 수 있음
        if (!session.isOpen()) {
            try {
                afterConnectionClosed(session, Objects.requireNonNull(CloseStatus.SERVER_ERROR));
            } catch (Exception e) {
                log.warn("전송 오류 후 방어적 세션 정리 실패 (세션 {})", session.getId(), e);
            }
        }
    }

    /**
     * 예외가 ClosedChannelException인지 확인한다.
     * IOException으로 래핑되어 있는 경우도 포함한다.
     *
     * @param exception 확인할 예외
     * @return cause chain 중 ClosedChannelException이 존재하면 {@code true}
     */
    private boolean isClosedChannelException(Throwable exception) {
        var current = exception;
        while (current != null) {
            if (current instanceof ClosedChannelException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
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
