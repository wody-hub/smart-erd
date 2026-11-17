package com.smarterd.domain.diagram.websocket.relay;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyByte;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.application.collaboration.query.LoadCollaborationHandoffUseCase;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.handoff.CollaborationHandoffResult;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

class DiagramHandoffSnapshotResponderTest {

    @Test
    @DisplayName("v2 snapshot request 는 snapshot blob 을 단건 응답으로 전송한다")
    void respond_v2SendsSingleSnapshotMessage() throws Exception {
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, messageSender, roomManager());
        final var session = mock(WebSocketSession.class);
        final var resourceKey = new CollaborationResourceKey("diagram", "1");
        final var context = new DiagramMessageContext(
            session,
            resourceKey,
            1L,
            "login-1",
            "user-1",
            new BinaryMessage(new byte[] { DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2 }),
            new byte[] { DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2 }
        );
        when(session.getAttributes()).thenReturn(
            Map.of(
                CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
                new CollaborationAuthenticatedSession("user-1", "login-1", "User", resourceKey, Instant.MAX, 3)
            )
        );
        final var wrapped = new byte[] { DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE_V2, 0x11 };

        when(loadUseCase.loadHandoffSnapshot(resourceKey)).thenReturn(
            new CollaborationHandoffResult(new byte[] { 0x11 }, "warm")
        );
        when(
            messageSender.wrapMessage(
                eq(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE_V2),
                argThat((bytes) -> java.util.Arrays.equals(bytes, new byte[] { 0x11 }))
            )
        ).thenReturn(wrapped);

        responder.respond(context);

        verify(messageSender).sendBinaryToSession(session, wrapped);
        verify(messageSender, never()).wrapMessage(eq((byte) 0x0F), any());
        verify(messageSender, never()).sendWrappedMessagesToSession(any(), anyByte(), any());
    }

    @Test
    @DisplayName("v1 snapshot request 는 length-prefixed blob 을 update 목록으로 풀어 전송한다")
    void respond_v1DecodesAndSendsWrappedUpdates() throws Exception {
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, messageSender, roomManager());
        final var session = mock(WebSocketSession.class);
        final var resourceKey = new CollaborationResourceKey("diagram", "1");
        final var snapshot = YjsUpdateFormat.encode(List.of(new byte[] { 0x11 }, new byte[] { 0x22, 0x33 }));
        final var context = new DiagramMessageContext(
            session,
            resourceKey,
            1L,
            "login-1",
            "user-1",
            new BinaryMessage(new byte[] { DiagramMessageTypes.MSG_SNAPSHOT_REQUEST }),
            new byte[] { DiagramMessageTypes.MSG_SNAPSHOT_REQUEST }
        );

        when(session.getAttributes()).thenReturn(
            Map.of(
                CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
                new CollaborationAuthenticatedSession("user-1", "login-1", "User", resourceKey, Instant.MAX, 3)
            )
        );
        when(loadUseCase.loadHandoffSnapshot(resourceKey)).thenReturn(
            new CollaborationHandoffResult(snapshot, "snapshot-store")
        );

        responder.respond(context);

        verify(messageSender).sendWrappedMessagesToSession(
            eq(session),
            eq(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE),
            argThat(
                (List<byte[]> updates) ->
                    updates.size() == 2 &&
                    java.util.Arrays.equals(updates.get(0), new byte[] { 0x11 }) &&
                    java.util.Arrays.equals(updates.get(1), new byte[] { 0x22, 0x33 })
            )
        );
        verify(messageSender, never()).sendBinaryToSession(any(), any());
    }

    @ParameterizedTest
    @CsvSource({ "1,5", "1,13", "2,5", "2,13", "3,5", "3,13" })
    @DisplayName("빈 snapshot은 peer가 없을 때 v3 요청 세션에만 초기화 확인을 보낸다")
    void respond_emptySnapshotConfirmsOnlyV3(int protocolVersion, byte requestType) throws Exception {
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var roomManager = roomManager();
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, messageSender, roomManager);
        final var session = mock(WebSocketSession.class);
        final var resourceKey = new CollaborationResourceKey("diagram", "1");
        final var context = context(session, resourceKey, requestType);
        when(session.getAttributes()).thenReturn(
            Map.of(
                CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
                new CollaborationAuthenticatedSession(
                    "user-1",
                    "login-1",
                    "User",
                    resourceKey,
                    Instant.MAX,
                    protocolVersion
                )
            )
        );
        when(loadUseCase.loadHandoffSnapshot(resourceKey)).thenReturn(
            new CollaborationHandoffResult(new byte[0], "snapshot-store")
        );
        if (protocolVersion == 3) {
            when(session.getId()).thenReturn("requester");
            final var closedPeer = mock(WebSocketSession.class);
            when(closedPeer.getId()).thenReturn("closed-peer");
            when(roomManager.getSessions(1L)).thenReturn(Set.of(session, closedPeer));
            when(messageSender.wrapMessage(eq((byte) 0x0F), argThat((byte[] body) -> body.length == 0))).thenReturn(
                new byte[] { 0x0F }
            );
        }

        responder.respond(context);

        if (protocolVersion == 3) {
            verify(messageSender).sendBinaryToSession(
                eq(session),
                argThat((byte[] bytes) -> java.util.Arrays.equals(bytes, new byte[] { 0x0F }))
            );
        } else {
            verifyNoInteractions(messageSender);
        }
        verify(messageSender, never()).sendWrappedMessagesToSession(any(), anyByte(), any());
    }

    @ParameterizedTest
    @CsvSource({ "5", "13" })
    @DisplayName("미반영 update가 있으면 빈 snapshot 확인을 보내지 않는다")
    void respond_emptySnapshotWithPendingUpdatesSendsNothing(byte requestType) {
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var roomManager = roomManager();
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, messageSender, roomManager);
        final var session = mock(WebSocketSession.class);
        final var resourceKey = new CollaborationResourceKey("diagram", "1");
        when(session.getId()).thenReturn("requester");
        when(roomManager.getSessions(1L)).thenReturn(Set.of(session));
        when(roomManager.hasUpdates(1L)).thenReturn(true);
        when(session.getAttributes()).thenReturn(
            Map.of(
                CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
                new CollaborationAuthenticatedSession("user-1", "login-1", "User", resourceKey, Instant.MAX, 3)
            )
        );
        when(loadUseCase.loadHandoffSnapshot(resourceKey)).thenReturn(
            new CollaborationHandoffResult(new byte[0], "snapshot-store")
        );

        responder.respond(context(session, resourceKey, requestType));

        verifyNoInteractions(messageSender);
    }

    @ParameterizedTest
    @CsvSource({ "5", "13" })
    @DisplayName("서버 기준으로 비어 있으면 다른 peer가 있어도 v3 세션에 초기화 확인을 보낸다")
    void respond_emptySnapshotWithOpenPeerStillConfirms(byte requestType) throws Exception {
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var roomManager = roomManager();
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, messageSender, roomManager);
        final var session = mock(WebSocketSession.class);
        final var peer = mock(WebSocketSession.class);
        final var resourceKey = new CollaborationResourceKey("diagram", "1");
        when(session.getId()).thenReturn("requester");
        when(peer.getId()).thenReturn("peer");
        when(peer.isOpen()).thenReturn(true);
        when(roomManager.getSessions(1L)).thenReturn(Set.of(session, peer));
        when(roomManager.hasUpdates(1L)).thenReturn(false);
        when(session.getAttributes()).thenReturn(
            Map.of(
                CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
                new CollaborationAuthenticatedSession("user-1", "login-1", "User", resourceKey, Instant.MAX, 3)
            )
        );
        when(loadUseCase.loadHandoffSnapshot(resourceKey)).thenReturn(
            new CollaborationHandoffResult(new byte[0], "snapshot-store")
        );
        when(messageSender.wrapMessage(eq((byte) 0x0F), argThat((byte[] body) -> body.length == 0))).thenReturn(
            new byte[] { 0x0F }
        );

        responder.respond(context(session, resourceKey, requestType));

        verify(messageSender).sendBinaryToSession(
            eq(session),
            argThat((byte[] bytes) -> java.util.Arrays.equals(bytes, new byte[] { 0x0F }))
        );
    }

    @Test
    @DisplayName("flush drain 후 commit 전 handoff는 빈 조회를 실행하지 않고 commit된 데이터를 전송한다")
    void respond_waitsForDrainedUpdatesToCommit() throws Exception {
        final var manager = new DiagramRoomManager(new WebSocketProperties());
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var sender = mock(DiagramMessageSender.class);
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, sender, manager);
        final var session = mock(WebSocketSession.class);
        final var key = new CollaborationResourceKey("diagram", "1");
        final var committed = new AtomicReference<>(new byte[0]);
        when(loadUseCase.loadHandoffSnapshot(key)).thenAnswer((invocation) ->
            new CollaborationHandoffResult(committed.get(), "db")
        );
        when(sender.wrapMessage(eq(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE_V2), any())).thenReturn(
            new byte[] { DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE_V2, 0x11 }
        );
        assertThat(manager.appendUpdate(1L, new byte[] { 0x11 })).isTrue();
        final var drained = new CountDownLatch(1);
        final var commit = new CountDownLatch(1);
        final var requested = new CountDownLatch(1);
        try (final var executor = Executors.newFixedThreadPool(2)) {
            final var flushing = executor.submit(() -> {
                synchronized (manager.getFlushLock(1L)) {
                    final var updates = manager.drainAndMergeUpdates(1L);
                    drained.countDown();
                    assertThat(commit.await(5, TimeUnit.SECONDS)).isTrue();
                    committed.set(updates);
                }
                return null;
            });
            try {
                assertThat(drained.await(5, TimeUnit.SECONDS)).isTrue();
                assertThat(manager.hasUpdates(1L)).isFalse();
                final var response = executor.submit(() -> {
                    requested.countDown();
                    responder.respond(context(session, key, DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2));
                });
                assertThat(requested.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> response.get(100, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                verifyNoInteractions(loadUseCase, sender);
                commit.countDown();
                flushing.get(5, TimeUnit.SECONDS);
                response.get(5, TimeUnit.SECONDS);
                verify(sender).wrapMessage(
                    eq(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE_V2),
                    argThat((byte[] bytes) -> java.util.Arrays.equals(bytes, committed.get()))
                );
                verify(sender).sendBinaryToSession(eq(session), any());
                verify(sender, never()).wrapMessage(eq(DiagramMessageTypes.MSG_EMPTY_DOCUMENT_INITIALIZED), any());
            } finally {
                commit.countDown();
            }
        }
    }

    private DiagramRoomManager roomManager() {
        final var manager = mock(DiagramRoomManager.class);
        when(manager.getFlushLock(1L)).thenReturn(new Object());
        return manager;
    }

    /**
     * 요청 타입별 responder 테스트 컨텍스트를 만든다.
     *
     * @param session 요청 세션
     * @param resourceKey 다이어그램 리소스 key
     * @param requestType snapshot 요청 타입
     * @return responder 컨텍스트
     */
    private DiagramMessageContext context(
        WebSocketSession session,
        CollaborationResourceKey resourceKey,
        byte requestType
    ) {
        return new DiagramMessageContext(
            session,
            resourceKey,
            1L,
            "login-1",
            "user-1",
            new BinaryMessage(new byte[] { requestType }),
            new byte[] { requestType }
        );
    }
}
