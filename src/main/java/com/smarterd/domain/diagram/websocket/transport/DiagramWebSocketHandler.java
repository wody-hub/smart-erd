package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.config.websocket.WebSocketProperties;
import java.nio.channels.ClosedChannelException;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class DiagramWebSocketHandler extends BinaryWebSocketHandler {

    /** 세션 cleanup 완료 플래그 (attributes 키) — 중복 afterConnectionClosed 방지 */
    private static final String CLEANED_UP_ATTR = "ws.cleanedUp";

    /** WebSocket 설정 프로퍼티 */
    private final WebSocketProperties webSocketProperties;

    /** inbound 세션/context 해석과 공통 guard */
    private final DiagramInboundMessageContextFactory inboundMessageContextFactory;

    /** 세션 join/leave/flush 수명주기 */
    private final DiagramWebSocketSessionLifecycle sessionLifecycle;

    /** inbound 메시지 디스패처 */
    private final DiagramWebSocketMessageDispatcher messageDispatcher;

    /**
     * WebSocket 연결 수립 후 호출된다.
     * 세션별 메시지 크기 제한을 설정하고, 해당 다이어그램 방에 입장시킨다.
     *
     * @param session WebSocket 세션
     */
    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        session.setBinaryMessageSizeLimit(webSocketProperties.getBinaryMessageSizeLimit());

        final var info = inboundMessageContextFactory.resolveEstablishedSession(session);
        if (info == null) {
            return;
        }

        sessionLifecycle.establish(session, info);
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
        final var context = inboundMessageContextFactory.createInboundContext(session, message);
        if (context == null) {
            return;
        }
        messageDispatcher.dispatch(context);
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

        final var info = inboundMessageContextFactory.resolveSession(session);
        sessionLifecycle.close(session, info);
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

}
