package com.smarterd.application.diagram.command;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.smarterd.application.diagram.model.DiagramPresenceParticipantPayload;
import com.smarterd.application.diagram.model.DiagramPresenceSnapshotPayload;
import com.smarterd.application.diagram.model.DiagramSessionJoinCompletion;
import com.smarterd.application.diagram.port.DiagramPresencePort;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CompleteDiagramSessionJoinUseCaseTest {

    @Test
    @DisplayName("join snapshot과 joined participant가 있으면 snapshot과 peer-joined를 모두 전송한다")
    void complete_whenJoinedParticipantExists_sendsSnapshotAndPeerJoined() {
        final var notifier = mock(DiagramPresencePort.class);
        final var useCase = new CompleteDiagramSessionJoinUseCase(notifier);
        final var sessionRef = new DiagramSessionRef("session-1");
        final var participant = new DiagramPresenceParticipantPayload("user-1", "User 1", 1L);
        final var snapshot = new DiagramPresenceSnapshotPayload("epoch-1", 2L, List.of(participant));
        final var joinCompletion = new DiagramSessionJoinCompletion(snapshot, participant, 2L);

        useCase.complete(sessionRef, 1L, joinCompletion);

        verify(notifier).sendPresenceSnapshotToSession(sessionRef, 1L, snapshot);
        verify(notifier).broadcastPeerJoined(1L, sessionRef, "epoch-1", 2L, participant);
        verifyNoMoreInteractions(notifier);
    }

    @Test
    @DisplayName("joined participant가 없으면 snapshot만 전송한다")
    void complete_whenJoinedParticipantMissing_onlySendsSnapshot() {
        final var notifier = mock(DiagramPresencePort.class);
        final var useCase = new CompleteDiagramSessionJoinUseCase(notifier);
        final var sessionRef = new DiagramSessionRef("session-2");
        final var snapshot = new DiagramPresenceSnapshotPayload("epoch-1", 2L, List.of());
        final var joinCompletion = new DiagramSessionJoinCompletion(snapshot, null, 0L);

        useCase.complete(sessionRef, 1L, joinCompletion);

        verify(notifier).sendPresenceSnapshotToSession(sessionRef, 1L, snapshot);
        verifyNoMoreInteractions(notifier);
    }
}
