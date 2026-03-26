package com.smarterd.domain.diagram.websocket.relay;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyByte;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.application.collaboration.query.LoadCollaborationHandoffUseCase;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.handoff.CollaborationHandoffResult;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

class DiagramHandoffSnapshotResponderTest {

    @Test
    @DisplayName("v2 snapshot request 는 snapshot blob 을 단건 응답으로 전송한다")
    void respond_v2SendsSingleSnapshotMessage() throws Exception {
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, messageSender);
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
        verify(messageSender, never()).sendWrappedMessagesToSession(any(), anyByte(), any());
    }

    @Test
    @DisplayName("v1 snapshot request 는 length-prefixed blob 을 update 목록으로 풀어 전송한다")
    void respond_v1DecodesAndSendsWrappedUpdates() throws Exception {
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, messageSender);
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

    @Test
    @DisplayName("빈 snapshot 은 응답을 보내지 않는다")
    void respond_emptySnapshotSendsNothing() throws Exception {
        final var loadUseCase = mock(LoadCollaborationHandoffUseCase.class);
        final var messageSender = mock(DiagramMessageSender.class);
        final var responder = new DiagramHandoffSnapshotResponder(loadUseCase, messageSender);
        final var session = mock(WebSocketSession.class);
        final var resourceKey = new CollaborationResourceKey("diagram", "1");
        final var context = new DiagramMessageContext(
            session,
            resourceKey,
            1L,
            "login-1",
            "user-1",
            new BinaryMessage(new byte[] { DiagramMessageTypes.MSG_SNAPSHOT_REQUEST }),
            new byte[] { DiagramMessageTypes.MSG_SNAPSHOT_REQUEST }
        );

        when(loadUseCase.loadHandoffSnapshot(resourceKey)).thenReturn(
            new CollaborationHandoffResult(new byte[0], "snapshot-store")
        );

        responder.respond(context);

        verify(messageSender, never()).sendBinaryToSession(any(), any());
        verify(messageSender, never()).sendWrappedMessagesToSession(any(), anyByte(), any());
    }
}
