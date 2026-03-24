package com.smarterd.application.diagram.command;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

class CompleteDiagramSessionLeaveUseCaseTest {

    @Test
    @DisplayName("leave 사용자와 room epoch가 있으면 peer-left와 legacy 메시지를 전송한다")
    void complete_whenPresenceChanged_broadcastsPeerLeft() {
        final var notifier = mock(DiagramPresenceNotifier.class);
        final var flushUseCase = mock(FlushDiagramDrainedUpdatesUseCase.class);
        final var useCase = new CompleteDiagramSessionLeaveUseCase(notifier, flushUseCase);
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
        final var leaveResult = new LeaveResult(false, new byte[0], "epoch-1", "user-1", 3L);

        useCase.complete(session, info, 1L, leaveResult);

        verify(notifier).broadcastPeerLeft(1L, session, "epoch-1", 3L, "user-1");
        verify(notifier).broadcastPeerLeftLegacy(1L, session, "login-1");
        verifyNoMoreInteractions(notifier);
        verifyNoMoreInteractions(flushUseCase);
    }

    @Test
    @DisplayName("방이 비면 drain된 update를 flush한다")
    void complete_whenRoomEmpty_flushesDrainedUpdates() {
        final var notifier = mock(DiagramPresenceNotifier.class);
        final var flushUseCase = mock(FlushDiagramDrainedUpdatesUseCase.class);
        final var useCase = new CompleteDiagramSessionLeaveUseCase(notifier, flushUseCase);
        final var session = mock(WebSocketSession.class);
        final var leaveResult = new LeaveResult(true, new byte[] { 0x11 }, null, null, 0L);

        useCase.complete(session, null, 1L, leaveResult);

        verify(flushUseCase).flush(1L, leaveResult.drainedUpdates());
        verifyNoMoreInteractions(flushUseCase);
        verifyNoMoreInteractions(notifier);
    }
}
