package com.smarterd.application.diagram.command;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.model.PresenceParticipant;
import com.smarterd.domain.diagram.websocket.model.PresenceSnapshot;
import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

class CompleteDiagramSessionJoinUseCaseTest {

    @Test
    @DisplayName("join snapshot과 joined participant가 있으면 snapshot과 peer-joined를 모두 전송한다")
    void complete_whenJoinedParticipantExists_sendsSnapshotAndPeerJoined() {
        final var notifier = mock(DiagramPresenceNotifier.class);
        final var useCase = new CompleteDiagramSessionJoinUseCase(notifier);
        final var session = mock(WebSocketSession.class);
        final var info = new DiagramWebSocketSessionInfo(
            "user-1",
            "login-1",
            "User 1",
            new CollaborationResourceKey("diagram", "1"),
            1L,
            Instant.now().plusSeconds(60),
            1
        );
        final var participant = new PresenceParticipant("user-1", "User 1", 1L);
        final var snapshot = new PresenceSnapshot("epoch-1", 2L, List.of(participant));
        final var joinResult = new JoinResult(true, snapshot, participant, 2L);

        useCase.complete(session, info, joinResult);

        verify(notifier).sendPresenceSnapshotToSession(session, 1L, snapshot);
        verify(notifier).broadcastPeerJoined(1L, session, "epoch-1", 2L, participant);
        verifyNoMoreInteractions(notifier);
    }

    @Test
    @DisplayName("joined participant가 없으면 snapshot만 전송한다")
    void complete_whenJoinedParticipantMissing_onlySendsSnapshot() {
        final var notifier = mock(DiagramPresenceNotifier.class);
        final var useCase = new CompleteDiagramSessionJoinUseCase(notifier);
        final var session = mock(WebSocketSession.class);
        final var info = new DiagramWebSocketSessionInfo(
            "user-1",
            "login-1",
            "User 1",
            new CollaborationResourceKey("diagram", "1"),
            1L,
            Instant.now().plusSeconds(60),
            1
        );
        final var snapshot = new PresenceSnapshot("epoch-1", 2L, List.of());
        final var joinResult = new JoinResult(true, snapshot, null, 0L);

        useCase.complete(session, info, joinResult);

        verify(notifier).sendPresenceSnapshotToSession(session, 1L, snapshot);
        verifyNoMoreInteractions(notifier);
    }
}
