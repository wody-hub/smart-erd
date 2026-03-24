package com.smarterd.application.diagram.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

class DiagramRealtimeSessionUseCaseTest {

    @Test
    @DisplayName("realtime update append 결과를 그대로 반환한다")
    void appendRealtimeUpdate_returnsRoomManagerResult() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var presenceNotifier = mock(DiagramPresenceNotifier.class);
        final var useCase = new DiagramRealtimeSessionUseCase(roomManager, presenceNotifier);
        final var update = new byte[] { 0x11, 0x22 };
        when(roomManager.appendUpdate(1L, update)).thenReturn(true);

        final var result = useCase.appendRealtimeUpdate(1L, update);

        assertThat(result).isTrue();
        verify(roomManager).appendUpdate(1L, update);
        verifyNoMoreInteractions(roomManager);
        verifyNoMoreInteractions(presenceNotifier);
    }

    @Test
    @DisplayName("presence snapshot 요청이 허용되면 최신 snapshot을 전송한다")
    void requestPresenceSnapshot_whenAllowed_sendsSnapshot() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var presenceNotifier = mock(DiagramPresenceNotifier.class);
        final var useCase = new DiagramRealtimeSessionUseCase(roomManager, presenceNotifier);
        final var session = mock(WebSocketSession.class);
        when(roomManager.allowPresenceSnapshotRequest(session)).thenReturn(true);

        final var result = useCase.requestPresenceSnapshot(session, 1L);

        assertThat(result).isTrue();
        verify(roomManager).allowPresenceSnapshotRequest(session);
        verify(presenceNotifier).sendPresenceSnapshotToSession(session, 1L, null);
        verifyNoMoreInteractions(roomManager);
        verifyNoMoreInteractions(presenceNotifier);
    }

    @Test
    @DisplayName("presence snapshot 요청이 rate limit에 걸리면 전송을 건너뛴다")
    void requestPresenceSnapshot_whenRateLimited_skipsSnapshot() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var presenceNotifier = mock(DiagramPresenceNotifier.class);
        final var useCase = new DiagramRealtimeSessionUseCase(roomManager, presenceNotifier);
        final var session = mock(WebSocketSession.class);
        when(roomManager.allowPresenceSnapshotRequest(session)).thenReturn(false);

        final var result = useCase.requestPresenceSnapshot(session, 1L);

        assertThat(result).isFalse();
        verify(roomManager).allowPresenceSnapshotRequest(session);
        verify(presenceNotifier, never()).sendPresenceSnapshotToSession(session, 1L, null);
        verifyNoMoreInteractions(roomManager);
        verifyNoMoreInteractions(presenceNotifier);
    }
}
