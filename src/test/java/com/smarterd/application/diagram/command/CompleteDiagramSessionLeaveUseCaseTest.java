package com.smarterd.application.diagram.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.smarterd.application.diagram.model.DiagramSessionLeaveCompletion;
import com.smarterd.application.diagram.port.DiagramPresencePort;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CompleteDiagramSessionLeaveUseCaseTest {

    @Test
    @DisplayName("leave 사용자와 room epoch가 있으면 peer-left를 전송한다")
    void complete_whenPresenceChanged_broadcastsPeerLeft() {
        final var notifier = mock(DiagramPresencePort.class);
        final var flushUseCase = mock(FlushDiagramDrainedUpdatesUseCase.class);
        final var useCase = new CompleteDiagramSessionLeaveUseCase(notifier, flushUseCase);
        final var sessionRef = new DiagramSessionRef("session-1");
        final var leaveCompletion = new DiagramSessionLeaveCompletion(false, new byte[0], "epoch-1", "user-1", 3L);

        useCase.complete(sessionRef, 1L, leaveCompletion);

        verify(notifier).broadcastPeerLeft(1L, sessionRef, "epoch-1", 3L, "user-1");
        verifyNoMoreInteractions(notifier);
        verifyNoMoreInteractions(flushUseCase);
    }

    @Test
    @DisplayName("방이 비면 drain된 update를 flush한다")
    void complete_whenRoomEmpty_flushesDrainedUpdates() {
        final var notifier = mock(DiagramPresencePort.class);
        final var flushUseCase = mock(FlushDiagramDrainedUpdatesUseCase.class);
        final var useCase = new CompleteDiagramSessionLeaveUseCase(notifier, flushUseCase);
        final var sessionRef = new DiagramSessionRef("session-2");
        final var leaveCompletion = new DiagramSessionLeaveCompletion(true, new byte[] { 0x11 }, null, null, 0L);

        useCase.complete(sessionRef, 1L, leaveCompletion);

        final ArgumentCaptor<byte[]> drainedUpdatesCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(flushUseCase).flush(org.mockito.ArgumentMatchers.eq(1L), drainedUpdatesCaptor.capture());
        assertThat(drainedUpdatesCaptor.getValue()).containsExactly(0x11);
        verifyNoMoreInteractions(flushUseCase);
        verifyNoMoreInteractions(notifier);
    }
}
