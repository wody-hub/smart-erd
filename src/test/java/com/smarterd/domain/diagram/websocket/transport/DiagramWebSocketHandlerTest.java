package com.smarterd.domain.diagram.websocket.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.application.diagram.command.CompleteDiagramSessionJoinUseCase;
import com.smarterd.application.diagram.command.CompleteDiagramSessionLeaveUseCase;
import com.smarterd.application.diagram.command.FlushDiagramDrainedUpdatesUseCase;
import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationSessionMetadataPolicy;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.diagram.websocket.session.AuthenticatedSession;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionResolver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

/**
 * {@link DiagramWebSocketHandler} 단위 테스트.
 */
class DiagramWebSocketHandlerTest {

    @Test
    @DisplayName("initHandlerMap - 필수 메시지 타입 핸들러가 누락되면 예외가 발생한다")
    void initHandlerMap_missingRequiredTypes_throwsException() {
        // given
        final var fixture = createFixture(List.of(new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_SYNC_STEP1))));

        // when & then
        assertThatThrownBy(fixture.messageDispatcher()::initHandlerMap)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("필수 메시지 핸들러 누락");
    }

    @Test
    @DisplayName("initHandlerMap - inbound가 아닌 타입 등록 시 예외가 발생한다")
    void initHandlerMap_withUnsupportedType_throwsException() {
        // given
        final var handlers = createRequiredHandlers();
        handlers.add(new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_PRESENCE_SNAPSHOT)));
        final var fixture = createFixture(handlers);

        // when & then
        assertThatThrownBy(fixture.messageDispatcher()::initHandlerMap)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("등록 불가 메시지 타입");
    }

    @Test
    @DisplayName("handleBinaryMessage - 메시지 타입에 맞는 핸들러로 디스패치한다")
    void handleBinaryMessage_dispatchesToMatchedHandler() {
        // given
        final var handlers = createRequiredHandlers();
        final var target = handlers
            .stream()
            .filter((h) -> h.supportedTypes().contains(DiagramMessageTypes.MSG_YJS_UPDATE))
            .findFirst()
            .orElseThrow();

        final var fixture = createFixture(handlers);
        fixture.messageDispatcher().initHandlerMap();

        final var session = mock(WebSocketSession.class);
        final var attributes = new HashMap<String, Object>();
        final var authenticatedSession = new AuthenticatedSession(
            "user-1",
            "login-1",
            "User 1",
            100L,
            Instant.now().plusSeconds(60),
            1
        );
        attributes.put(
            com.smarterd.collaboration.session.CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
            authenticatedSession.toCollaborationSession()
        );

        when(session.getId()).thenReturn("session-1");
        when(session.getAttributes()).thenReturn(attributes);
        when(fixture.diagramSessionTransportUseCase().allowMessage(session)).thenReturn(true);
        when(fixture.messageSender().extractPayload(any(BinaryMessage.class))).thenReturn(
            new byte[] { DiagramMessageTypes.MSG_YJS_UPDATE, 0x01 }
        );

        // when
        fixture.handler().handleBinaryMessage(session, new BinaryMessage(new byte[] { 0x00 }));

        // then
        assertThat(target.callCount).isEqualTo(1);
        assertThat(target.lastContext).isNotNull();
        assertThat(target.lastContext.diagramId()).isEqualTo(100L);
        assertThat(target.lastContext.messageType()).isEqualTo(DiagramMessageTypes.MSG_YJS_UPDATE);
    }

    @Test
    @DisplayName("handleBinaryMessage - 알 수 없는 메시지 타입은 무시한다")
    void handleBinaryMessage_unknownType_ignored() {
        // given
        final var handlers = createRequiredHandlers();
        final var fixture = createFixture(handlers);
        fixture.messageDispatcher().initHandlerMap();

        final var session = mock(WebSocketSession.class);
        final var attributes = new HashMap<String, Object>();
        final var authenticatedSession = new AuthenticatedSession(
            "user-1",
            "login-1",
            "User 1",
            100L,
            Instant.now().plusSeconds(60),
            1
        );
        attributes.put(
            com.smarterd.collaboration.session.CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
            authenticatedSession.toCollaborationSession()
        );
        when(session.getId()).thenReturn("session-1");
        when(session.getAttributes()).thenReturn(attributes);
        when(fixture.diagramSessionTransportUseCase().allowMessage(session)).thenReturn(true);
        when(fixture.messageSender().extractPayload(any(BinaryMessage.class))).thenReturn(
            new byte[] { (byte) 0x7F, 0x01 }
        );

        // when
        fixture.handler().handleBinaryMessage(session, new BinaryMessage(new byte[] { 0x00 }));

        // then
        handlers.forEach((h) -> assertThat(h.callCount).isZero());
    }

    @Test
    @DisplayName("afterConnectionEstablished - 세션 메타데이터가 없으면 연결을 거부한다")
    void afterConnectionEstablished_withoutSessionInfo_closesSession() throws Exception {
        // given
        final var fixture = createFixture(createRequiredHandlers());
        fixture.messageDispatcher().initHandlerMap();
        final var session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        when(session.getAttributes()).thenReturn(new HashMap<>());

        // when
        fixture.handler().afterConnectionEstablished(session);

        // then
        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verifyNoMoreInteractions(fixture.diagramSessionTransportUseCase());
    }

    @Test
    @DisplayName("handleBinaryMessage - 세션 메타데이터가 없으면 메시지 처리를 중단하고 연결을 종료한다")
    void handleBinaryMessage_withoutSessionInfo_closesSession() throws Exception {
        // given
        final var fixture = createFixture(createRequiredHandlers());
        fixture.messageDispatcher().initHandlerMap();
        final var session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        when(session.getAttributes()).thenReturn(new HashMap<>());

        // when
        fixture.handler().handleBinaryMessage(session, new BinaryMessage(new byte[] { 0x01 }));

        // then
        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verify(fixture.diagramSessionTransportUseCase(), never()).allowMessage(session);
    }

    @Test
    @DisplayName("handleBinaryMessage - 세션 메타데이터 타입이 올바르지 않아도 예외 없이 연결을 종료한다")
    void handleBinaryMessage_withInvalidSessionInfoType_closesSessionSafely() throws Exception {
        // given
        final var fixture = createFixture(createRequiredHandlers());
        fixture.messageDispatcher().initHandlerMap();
        final var session = mock(WebSocketSession.class);
        final var attributes = new HashMap<String, Object>();
        attributes.put(
            com.smarterd.collaboration.session.CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
            "invalid-session-info"
        );
        when(session.getId()).thenReturn("session-1");
        when(session.getAttributes()).thenReturn(attributes);

        // when
        fixture.handler().handleBinaryMessage(session, new BinaryMessage(new byte[] { 0x01 }));

        // then
        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verify(fixture.diagramSessionTransportUseCase(), never()).allowMessage(session);
    }

    @Test
    @DisplayName("afterConnectionClosed - 세션 메타데이터가 없어도 rate limit 정리는 수행한다")
    void afterConnectionClosed_withoutSessionInfo_cleansRateLimitOnly() {
        // given
        final var fixture = createFixture(createRequiredHandlers());
        fixture.messageDispatcher().initHandlerMap();
        final var session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        when(session.getAttributes()).thenReturn(new HashMap<>());
        when(fixture.diagramSessionTransportUseCase().close(session, null, null)).thenReturn(null);

        // when
        fixture.handler().afterConnectionClosed(session, CloseStatus.NORMAL);

        // then
        verify(fixture.diagramSessionTransportUseCase()).close(session, null, null);
    }

    @Test
    @DisplayName("afterConnectionClosed - 세션 메타데이터가 없어도 room 조회가 가능하면 leave를 수행한다")
    void afterConnectionClosed_withoutSessionInfo_butRoomFound_leavesRoom() {
        // given
        final var fixture = createFixture(createRequiredHandlers());
        fixture.messageDispatcher().initHandlerMap();
        final var session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        when(session.getAttributes()).thenReturn(new HashMap<>());
        when(fixture.diagramSessionTransportUseCase().close(session, null, null)).thenReturn(
            new DiagramSessionCloseResult(100L, new LeaveResult(false, new byte[0], null, null, 0))
        );

        // when
        fixture.handler().afterConnectionClosed(session, CloseStatus.NORMAL);

        // then
        verify(fixture.diagramSessionTransportUseCase()).close(session, null, null);
    }

    private Fixture createFixture(List<TestMessageHandler> handlers) {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var snapshotService = mock(DiagramSnapshotService.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var presenceNotifier = mock(DiagramPresenceNotifier.class);
        final var sessionLifecycle = new DiagramWebSocketSessionLifecycle(
            diagramSessionTransportUseCase,
            new CompleteDiagramSessionJoinUseCase(presenceNotifier),
            new CompleteDiagramSessionLeaveUseCase(
                presenceNotifier,
                new FlushDiagramDrainedUpdatesUseCase(mock(DiagramRoomManager.class), snapshotService)
            ),
            presenceNotifier
        );
        final var messageDispatcher = new DiagramWebSocketMessageDispatcher(new ArrayList<>(handlers));
        final var resourceKeyFactory = new DiagramCollaborationResourceKeyFactory();
        final var sessionResolver = new DiagramWebSocketSessionResolver(
            resourceKeyFactory,
            new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory)
        );
        final var inboundMessageContextFactory = new DiagramInboundMessageContextFactory(
            diagramSessionTransportUseCase,
            messageSender,
            sessionResolver
        );
        final var handler = new DiagramWebSocketHandler(
            new WebSocketProperties(),
            inboundMessageContextFactory,
            sessionLifecycle,
            messageDispatcher
        );
        return new Fixture(handler, diagramSessionTransportUseCase, messageSender, messageDispatcher);
    }

    private List<TestMessageHandler> createRequiredHandlers() {
        return new ArrayList<>(
            List.of(
                new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_SYNC_STEP1)),
                new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_SYNC_STEP2)),
                new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_YJS_UPDATE)),
                new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_AWARENESS)),
                new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_SNAPSHOT_REQUEST)),
                new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2)),
                new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_COMPACTED_SNAPSHOT)),
                new TestMessageHandler(Set.of(DiagramMessageTypes.MSG_PRESENCE_SNAPSHOT_REQUEST))
            )
        );
    }

    private record Fixture(
        DiagramWebSocketHandler handler,
        DiagramSessionTransportUseCase diagramSessionTransportUseCase,
        DiagramMessageSender messageSender,
        DiagramWebSocketMessageDispatcher messageDispatcher
    ) {}

    private static final class TestMessageHandler implements DiagramMessageHandler {

        private final Set<Byte> supportedTypes;
        private int callCount;
        private DiagramMessageContext lastContext;

        private TestMessageHandler(Set<Byte> supportedTypes) {
            this.supportedTypes = supportedTypes;
        }

        @Override
        public Set<Byte> supportedTypes() {
            return supportedTypes;
        }

        @Override
        public void handle(DiagramMessageContext context) {
            callCount++;
            lastContext = context;
        }
    }
}
