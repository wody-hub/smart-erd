package com.smarterd.domain.diagram.websocket.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionResolver;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

class DiagramInboundMessageContextFactoryTest {

    @Test
    @DisplayName("연결 수립 시 세션 메타데이터가 없으면 policy violation으로 종료한다")
    void resolveEstablishedSession_withoutSessionInfo_closesSession() throws Exception {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var sessionResolver = mock(DiagramWebSocketSessionResolver.class);
        final var factory = new DiagramInboundMessageContextFactory(
            diagramSessionTransportUseCase,
            messageSender,
            sessionResolver
        );
        final var session = mock(WebSocketSession.class);

        when(session.getId()).thenReturn("session-1");
        when(sessionResolver.resolve(session)).thenReturn(null);

        final var resolved = factory.resolveEstablishedSession(session);

        assertThat(resolved).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verify(diagramSessionTransportUseCase, never()).allowMessage(any());
    }

    @Test
    @DisplayName("만료된 세션은 inbound context를 만들지 않고 연결을 종료한다")
    void createInboundContext_withExpiredSession_closesSession() throws Exception {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var sessionResolver = mock(DiagramWebSocketSessionResolver.class);
        final var factory = new DiagramInboundMessageContextFactory(
            diagramSessionTransportUseCase,
            messageSender,
            sessionResolver
        );
        final var session = mock(WebSocketSession.class);
        final var message = new BinaryMessage(new byte[] { DiagramMessageTypes.MSG_SYNC_STEP1 });
        final var info = new DiagramWebSocketSessionInfo(
            "user-1",
            "login-1",
            "User 1",
            new CollaborationResourceKey("diagram", "100"),
            100L,
            Instant.now().minusSeconds(5),
            1
        );

        when(session.getId()).thenReturn("session-1");
        when(sessionResolver.resolve(session)).thenReturn(info);

        final var context = factory.createInboundContext(session, message);

        assertThat(context).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verify(diagramSessionTransportUseCase, never()).allowMessage(session);
    }

    @Test
    @DisplayName("rate limit 초과 메시지는 inbound context를 만들지 않는다")
    void createInboundContext_whenRateLimited_returnsNull() {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var sessionResolver = mock(DiagramWebSocketSessionResolver.class);
        final var factory = new DiagramInboundMessageContextFactory(
            diagramSessionTransportUseCase,
            messageSender,
            sessionResolver
        );
        final var session = mock(WebSocketSession.class);
        final var message = new BinaryMessage(new byte[] { DiagramMessageTypes.MSG_SYNC_STEP1 });
        final var info = new DiagramWebSocketSessionInfo(
            "user-1",
            "login-1",
            "User 1",
            new CollaborationResourceKey("diagram", "100"),
            100L,
            Instant.now().plusSeconds(60),
            1
        );

        when(session.getId()).thenReturn("session-1");
        when(sessionResolver.resolve(session)).thenReturn(info);
        when(diagramSessionTransportUseCase.allowMessage(session)).thenReturn(false);

        final var context = factory.createInboundContext(session, message);

        assertThat(context).isNull();
        verify(messageSender, never()).extractPayload(any());
    }

    @Test
    @DisplayName("빈 payload는 무시한다")
    void createInboundContext_withEmptyPayload_returnsNull() {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var sessionResolver = mock(DiagramWebSocketSessionResolver.class);
        final var factory = new DiagramInboundMessageContextFactory(
            diagramSessionTransportUseCase,
            messageSender,
            sessionResolver
        );
        final var session = mock(WebSocketSession.class);
        final var message = new BinaryMessage(new byte[] { DiagramMessageTypes.MSG_SYNC_STEP1 });
        final var info = new DiagramWebSocketSessionInfo(
            "user-1",
            "login-1",
            "User 1",
            new CollaborationResourceKey("diagram", "100"),
            100L,
            Instant.now().plusSeconds(60),
            1
        );

        when(session.getId()).thenReturn("session-1");
        when(sessionResolver.resolve(session)).thenReturn(info);
        when(diagramSessionTransportUseCase.allowMessage(session)).thenReturn(true);
        when(messageSender.extractPayload(message)).thenReturn(new byte[0]);

        final var context = factory.createInboundContext(session, message);

        assertThat(context).isNull();
    }

    @Test
    @DisplayName("유효한 메시지는 dispatch 가능한 inbound context로 변환한다")
    void createInboundContext_withValidMessage_returnsContext() {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var sessionResolver = mock(DiagramWebSocketSessionResolver.class);
        final var factory = new DiagramInboundMessageContextFactory(
            diagramSessionTransportUseCase,
            messageSender,
            sessionResolver
        );
        final var session = mock(WebSocketSession.class);
        final var message = new BinaryMessage(new byte[] { DiagramMessageTypes.MSG_YJS_UPDATE, 0x01 });
        final var payload = new byte[] { DiagramMessageTypes.MSG_YJS_UPDATE, 0x01 };
        final var info = new DiagramWebSocketSessionInfo(
            "user-1",
            "login-1",
            "User 1",
            new CollaborationResourceKey("diagram", "100"),
            100L,
            Instant.now().plusSeconds(60),
            1
        );

        when(session.getId()).thenReturn("session-1");
        when(sessionResolver.resolve(session)).thenReturn(info);
        when(diagramSessionTransportUseCase.allowMessage(session)).thenReturn(true);
        when(messageSender.extractPayload(message)).thenReturn(payload);

        final var context = factory.createInboundContext(session, message);

        assertThat(context).isNotNull();
        assertThat(context.diagramId()).isEqualTo(100L);
        assertThat(context.sessionId()).isEqualTo("session-1");
        assertThat(context.messageType()).isEqualTo(DiagramMessageTypes.MSG_YJS_UPDATE);
        assertThat(context.payload()).isEqualTo(payload);
    }
}
