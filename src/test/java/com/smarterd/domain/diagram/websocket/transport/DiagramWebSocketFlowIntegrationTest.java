package com.smarterd.domain.diagram.websocket.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.collaboration.query.LoadCollaborationHandoffUseCase;
import com.smarterd.collaboration.channel.DefaultCollaborationRuntimeSupportRegistry;
import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationHandoffPolicy;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationRuntimeSupport;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationSessionMetadataPolicy;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationSnapshotStore;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.relay.handler.AwarenessMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.handler.CompactedSnapshotMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.handler.PresenceSnapshotRequestMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.handler.SnapshotRequestMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.handler.SyncRelayMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.handler.YjsUpdateMessageHandler;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.diagram.websocket.session.AuthenticatedSession;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionResolver;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다중 세션 협업 흐름을 검증하는 WebSocket 컴포넌트 통합 테스트.
 *
 * <p>실제 소켓 서버를 띄우지 않고, {@link DiagramWebSocketHandler}와 메시지 핸들러 체인을
 * 실제 구성으로 묶어 세션 간 상호작용을 검증한다.</p>
 */
@SuppressWarnings("null")
class DiagramWebSocketFlowIntegrationTest {

    @Test
    @DisplayName("YJS_UPDATE - 같은 room의 다른 세션으로 relay되고 update 버퍼에 누적된다")
    void yjsUpdate_relayAndAppendUpdate() throws Exception {
        // given
        final var fixture = createFixture(100);
        final var diagramId = 1L;
        final var s1 = newSession("s1", "u1", "login1", "User 1", diagramId);
        final var s2 = newSession("s2", "u2", "login2", "User 2", diagramId);

        fixture.handler().afterConnectionEstablished(s1.session());
        fixture.handler().afterConnectionEstablished(s2.session());
        s1.clearInbox();
        s2.clearInbox();

        final var updatePayload = new byte[] { DiagramMessageTypes.MSG_YJS_UPDATE, 0x11, 0x22 };

        // when
        fixture.handler().handleBinaryMessage(s1.session(), new BinaryMessage(updatePayload));

        // then - relay
        assertThat(s2.inbox()).hasSize(1);
        assertThat(messageType(s2.inbox().get(0))).isEqualTo(DiagramMessageTypes.MSG_YJS_UPDATE);
        assertThat(messagePayload(s2.inbox().get(0))).isEqualTo(updatePayload);
        assertThat(s1.inbox()).isEmpty();

        // then - append
        final var drained = fixture.roomManager().drainAndMergeUpdates(diagramId);
        final var decoded = YjsUpdateFormat.decode(drained);
        assertThat(decoded).hasSize(1);
        assertThat(decoded.get(0)).isEqualTo(new byte[] { 0x11, 0x22 });
    }

    @Test
    @DisplayName("Presence - join/leave 시 snapshot, peer joined/left 메시지가 전파된다")
    void presence_joinAndLeave_flowWorks() throws Exception {
        // given
        final var fixture = createFixture(100);
        final var diagramId = 10L;
        final var s1 = newSession("s1", "u1", "login1", "User 1", diagramId);
        final var s2 = newSession("s2", "u2", "login2", "User 2", diagramId);

        // when - first join
        fixture.handler().afterConnectionEstablished(s1.session());

        // then
        assertThat(messageTypes(s1.inbox())).contains(DiagramMessageTypes.MSG_PRESENCE_SNAPSHOT);
        s1.clearInbox();

        // when - second join
        fixture.handler().afterConnectionEstablished(s2.session());

        // then
        assertThat(messageTypes(s2.inbox())).contains(DiagramMessageTypes.MSG_PRESENCE_SNAPSHOT);
        assertThat(messageTypes(s1.inbox())).contains(DiagramMessageTypes.MSG_PEER_JOINED);
        s1.clearInbox();
        s2.clearInbox();

        // when - second leave
        fixture.handler().afterConnectionClosed(s2.session(), CloseStatus.NORMAL);

        // then
        final var types = messageTypes(s1.inbox());
        assertThat(types).contains(DiagramMessageTypes.MSG_PEER_LEFT);
        assertThat(types).contains(DiagramMessageTypes.MSG_PEER_LEFT_LEGACY);
    }

    @Test
    @DisplayName("Rate limit - 초당 제한을 넘는 burst는 일부 드롭된다")
    void rateLimit_dropsBurstMessages() throws Exception {
        // given
        final var fixture = createFixture(1);
        final var diagramId = 30L;
        final var s1 = newSession("s1", "u1", "login1", "User 1", diagramId);
        final var s2 = newSession("s2", "u2", "login2", "User 2", diagramId);
        fixture.handler().afterConnectionEstablished(s1.session());
        fixture.handler().afterConnectionEstablished(s2.session());
        s2.clearInbox();

        final var payload = new byte[] { DiagramMessageTypes.MSG_SYNC_STEP1, 0x01 };

        // when - burst
        for (int i = 0; i < 5; i++) {
            fixture.handler().handleBinaryMessage(s1.session(), new BinaryMessage(payload));
        }

        // then
        final var relayedCount = s2
            .inbox()
            .stream()
            .map(this::messageType)
            .filter((t) -> t == DiagramMessageTypes.MSG_SYNC_STEP1)
            .count();
        assertThat(relayedCount).isLessThan(5);
        assertThat(relayedCount).isGreaterThan(0);
    }

    @Test
    @DisplayName("Reconnect - 세션 재연결 후에도 room relay가 정상 동작한다")
    void reconnect_relayStillWorks() throws Exception {
        // given
        final var fixture = createFixture(100);
        final var diagramId = 50L;
        final var s1 = newSession("s1", "u1", "login1", "User 1", diagramId);
        final var s2 = newSession("s2", "u2", "login2", "User 2", diagramId);
        fixture.handler().afterConnectionEstablished(s1.session());
        fixture.handler().afterConnectionEstablished(s2.session());
        s1.clearInbox();
        s2.clearInbox();

        // when - disconnect + reconnect
        fixture.handler().afterConnectionClosed(s1.session(), CloseStatus.NORMAL);
        final var s1Reconnect = newSession("s1-re", "u1", "login1", "User 1", diagramId);
        fixture.handler().afterConnectionEstablished(s1Reconnect.session());
        s1Reconnect.clearInbox();

        fixture
            .handler()
            .handleBinaryMessage(
                s2.session(),
                new BinaryMessage(new byte[] { DiagramMessageTypes.MSG_SYNC_STEP1, 0x55 })
            );

        // then
        assertThat(fixture.roomManager().getSessionCount(diagramId)).isEqualTo(2);
        assertThat(messageTypes(s1Reconnect.inbox())).contains(DiagramMessageTypes.MSG_SYNC_STEP1);
    }

    private Fixture createFixture(int maxMessagesPerSecond) {
        final var properties = new WebSocketProperties();
        properties.setMaxMessagesPerSecond(maxMessagesPerSecond);
        properties.setMaxSessionsPerRoom(10);
        properties.setMaxConnectionsPerUser(5);
        properties.setBinaryMessageSizeLimit(1024 * 1024);
        properties.setMaxAccumulatedUpdatesSize(10 * 1024 * 1024);
        properties.setSessionMaxDuration(1800000);

        final var snapshotService = mock(DiagramSnapshotService.class);
        final var roomManager = new DiagramRoomManager(properties);
        final var objectMapper = new ObjectMapper();
        final var messageSender = new DiagramMessageSender(roomManager, objectMapper);
        final var presenceNotifier = new DiagramPresenceNotifier(roomManager, messageSender);
        final var sessionLifecycle = new DiagramWebSocketSessionLifecycle(
            roomManager,
            snapshotService,
            presenceNotifier
        );
        final var resourceKeyFactory = new DiagramCollaborationResourceKeyFactory();
        final var diagramRuntimeSupport = new DiagramCollaborationRuntimeSupport(
            new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory),
            new DiagramCollaborationSnapshotStore(snapshotService, resourceKeyFactory),
            new DiagramCollaborationHandoffPolicy(roomManager, snapshotService, resourceKeyFactory)
        );
        final var runtimeSupportRegistry = new DefaultCollaborationRuntimeSupportRegistry(List.of(diagramRuntimeSupport));
        final var loadCollaborationHandoffUseCase = new LoadCollaborationHandoffUseCase(runtimeSupportRegistry);
        final var sessionResolver = new DiagramWebSocketSessionResolver(
            resourceKeyFactory,
            new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory)
        );

        final var handlers = List.<DiagramMessageHandler>of(
            new SyncRelayMessageHandler(messageSender),
            new YjsUpdateMessageHandler(roomManager, messageSender),
            new AwarenessMessageHandler(objectMapper, messageSender),
            new SnapshotRequestMessageHandler(
                roomManager,
                loadCollaborationHandoffUseCase,
                messageSender
            ),
            new CompactedSnapshotMessageHandler(roomManager, snapshotService),
            new PresenceSnapshotRequestMessageHandler(roomManager, presenceNotifier)
        );
        final var messageDispatcher = new DiagramWebSocketMessageDispatcher(handlers);

        final var handler = new DiagramWebSocketHandler(
            properties,
            roomManager,
            messageSender,
            sessionResolver,
            sessionLifecycle,
            messageDispatcher
        );
        messageDispatcher.initHandlerMap();
        return new Fixture(handler, roomManager);
    }

    private SessionProbe newSession(String sessionId, String userId, String loginId, String userName, Long diagramId)
        throws Exception {
        final var session = mock(WebSocketSession.class);
        final Map<String, Object> attributes = new ConcurrentHashMap<>();
        final var legacySession = new AuthenticatedSession(
            userId,
            loginId,
            userName,
            diagramId,
            Instant.now().plusSeconds(60),
            1
        );
        attributes.put(
            com.smarterd.collaboration.session.CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
            legacySession.toCollaborationSession()
        );

        final var inbox = new CopyOnWriteArrayList<BinaryMessage>();
        final var open = new AtomicBoolean(true);

        when(session.getId()).thenReturn(sessionId);
        when(session.getAttributes()).thenReturn(attributes);
        when(session.isOpen()).thenAnswer((invocation) -> open.get());
        doAnswer((invocation) -> {
            open.set(false);
            return null;
        })
            .when(session)
            .close(any(CloseStatus.class));
        doAnswer((invocation) -> {
            open.set(false);
            return null;
        })
            .when(session)
            .close();

        doAnswer((invocation) -> {
            final var raw = (WebSocketMessage<?>) invocation.getArgument(0);
            if (raw instanceof BinaryMessage binaryMessage) {
                inbox.add(new BinaryMessage(messagePayload(binaryMessage)));
            }
            return null;
        })
            .when(session)
            .sendMessage(any());

        return new SessionProbe(session, inbox);
    }

    private byte messageType(BinaryMessage message) {
        return messagePayload(message)[0];
    }

    private byte[] messagePayload(BinaryMessage message) {
        final ByteBuffer payload = message.getPayload().asReadOnlyBuffer();
        final var bytes = new byte[payload.remaining()];
        payload.get(bytes);
        return bytes;
    }

    private Set<Byte> messageTypes(List<BinaryMessage> messages) {
        return messages.stream().map(this::messageType).collect(java.util.stream.Collectors.toSet());
    }

    private record Fixture(DiagramWebSocketHandler handler, DiagramRoomManager roomManager) {}

    private record SessionProbe(WebSocketSession session, List<BinaryMessage> inbox) {
        void clearInbox() {
            inbox.clear();
        }
    }
}
