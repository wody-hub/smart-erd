package com.smarterd.application.diagram.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.application.diagram.port.DiagramPresencePort;
import com.smarterd.application.diagram.port.DiagramRealtimeSessionPort;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DiagramRealtimeSessionUseCaseTest {

    @Test
    @DisplayName("realtime update append 결과를 그대로 반환한다")
    void appendRealtimeUpdate_returnsRoomManagerResult() {
        final var realtimeSessionPort = mock(DiagramRealtimeSessionPort.class);
        final var presenceNotifier = mock(DiagramPresencePort.class);
        final var useCase = new DiagramRealtimeSessionUseCase(realtimeSessionPort, presenceNotifier);
        final var update = new byte[] { 0x11, 0x22 };
        when(realtimeSessionPort.appendRealtimeUpdate(1L, update)).thenReturn(true);

        final var result = useCase.appendRealtimeUpdate(1L, update);

        assertThat(result).isTrue();
        verify(realtimeSessionPort).appendRealtimeUpdate(1L, update);
        verifyNoMoreInteractions(realtimeSessionPort);
        verifyNoMoreInteractions(presenceNotifier);
    }

    @Test
    @DisplayName("presence snapshot 요청이 허용되면 최신 snapshot을 전송한다")
    void requestPresenceSnapshot_whenAllowed_sendsSnapshot() {
        final var realtimeSessionPort = mock(DiagramRealtimeSessionPort.class);
        final var presenceNotifier = mock(DiagramPresencePort.class);
        final var useCase = new DiagramRealtimeSessionUseCase(realtimeSessionPort, presenceNotifier);
        final var sessionRef = new DiagramSessionRef("session-1");
        when(realtimeSessionPort.allowPresenceSnapshotRequest(sessionRef)).thenReturn(true);

        final var result = useCase.requestPresenceSnapshot(sessionRef, 1L);

        assertThat(result).isTrue();
        verify(realtimeSessionPort).allowPresenceSnapshotRequest(sessionRef);
        verify(presenceNotifier).sendPresenceSnapshotToSession(sessionRef, 1L, null);
        verifyNoMoreInteractions(realtimeSessionPort);
        verifyNoMoreInteractions(presenceNotifier);
    }

    @Test
    @DisplayName("presence snapshot 요청이 rate limit에 걸리면 전송을 건너뛴다")
    void requestPresenceSnapshot_whenRateLimited_skipsSnapshot() {
        final var realtimeSessionPort = mock(DiagramRealtimeSessionPort.class);
        final var presenceNotifier = mock(DiagramPresencePort.class);
        final var useCase = new DiagramRealtimeSessionUseCase(realtimeSessionPort, presenceNotifier);
        final var sessionRef = new DiagramSessionRef("session-1");
        when(realtimeSessionPort.allowPresenceSnapshotRequest(sessionRef)).thenReturn(false);

        final var result = useCase.requestPresenceSnapshot(sessionRef, 1L);

        assertThat(result).isFalse();
        verify(realtimeSessionPort).allowPresenceSnapshotRequest(sessionRef);
        verify(presenceNotifier, never()).sendPresenceSnapshotToSession(sessionRef, 1L, null);
        verifyNoMoreInteractions(realtimeSessionPort);
        verifyNoMoreInteractions(presenceNotifier);
    }
}
