package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionResolver;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

/**
 * WebSocket transport가 사용할 session/context 해석과 공통 guard를 담당한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DiagramInboundMessageContextFactory {

    private final DiagramSessionTransportUseCase diagramSessionTransportUseCase;
    private final DiagramMessageSender messageSender;
    private final DiagramWebSocketSessionResolver sessionResolver;

    /**
     * 연결 수립 시 필요한 세션 메타데이터를 해석한다.
     *
     * @param session WebSocket 세션
     * @return 정규화된 세션 메타데이터. 없으면 연결 종료 후 {@code null}
     */
    @Nullable
    public DiagramWebSocketSessionInfo resolveEstablishedSession(WebSocketSession session) {
        return resolveSessionOrClose(session, "WebSocket 세션 메타데이터 누락으로 연결 거부");
    }

    /**
     * 종료 정리에서 사용할 세션 메타데이터를 조용히 조회한다.
     *
     * @param session WebSocket 세션
     * @return 정규화된 세션 메타데이터. 없으면 {@code null}
     */
    @Nullable
    public DiagramWebSocketSessionInfo resolveSession(WebSocketSession session) {
        return sessionResolver.resolve(session);
    }

    /**
     * inbound 바이너리 메시지를 dispatch 가능한 컨텍스트로 변환한다.
     *
     * @param session WebSocket 세션
     * @param message 수신 메시지
     * @return dispatch 가능한 메시지 컨텍스트. guard에 걸리면 {@code null}
     */
    @Nullable
    public DiagramMessageContext createInboundContext(WebSocketSession session, BinaryMessage message) {
        final var info = resolveSessionOrClose(session, "WebSocket 세션 메타데이터 누락으로 메시지 처리 중단");
        if (info == null) {
            return null;
        }

        if (info.isExpired()) {
            log.info("WebSocket 세션 만료 (세션 {}, loginId={})", session.getId(), info.loginId());
            closePolicyViolation(session, "만료 세션 종료 실패");
            return null;
        }

        if (!diagramSessionTransportUseCase.allowMessage(session)) {
            log.warn("Rate limit 초과 (세션 {})", session.getId());
            return null;
        }

        final var payload = messageSender.extractPayload(message);
        if (payload.length == 0) {
            return null;
        }

        return new DiagramMessageContext(
            session,
            info.resourceKey(),
            info.diagramId(),
            info.loginId(),
            info.userId(),
            message,
            payload
        );
    }

    private DiagramWebSocketSessionInfo resolveSessionOrClose(
        WebSocketSession session,
        String missingSessionMessage
    ) {
        final var info = sessionResolver.resolve(session);
        if (info == null) {
            log.warn("{} (세션 {})", missingSessionMessage, session.getId());
            closePolicyViolation(session, "메타데이터 누락 세션 종료 실패");
        }
        return info;
    }

    private void closePolicyViolation(WebSocketSession session, String failureMessage) {
        try {
            session.close(Objects.requireNonNull(CloseStatus.POLICY_VIOLATION));
        } catch (Exception e) {
            log.warn("{} (세션 {})", failureMessage, session.getId(), e);
        }
    }
}
