package com.smarterd.domain.diagram.websocket.transport;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.application.diagram.command.CompleteDiagramSessionJoinUseCase;
import com.smarterd.application.diagram.command.CompleteDiagramSessionLeaveUseCase;
import com.smarterd.application.diagram.model.DiagramPresenceParticipantPayload;
import com.smarterd.application.diagram.model.DiagramPresenceSnapshotPayload;
import com.smarterd.application.diagram.model.DiagramSessionJoinCompletion;
import com.smarterd.application.diagram.model.DiagramSessionLeaveCompletion;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

class DiagramWebSocketSessionLifecycleTest {

    @Test
    @DisplayName("join 거부 시 세션을 policy violation으로 종료하고 후속 join 처리를 호출하지 않는다")
    void establish_whenJoinRejected_closesSessionAndSkipsJoinCompletion() throws Exception {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var legacyPresencePort = mock(DiagramLegacyPresencePort.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(
            diagramSessionTransportUseCase,
            completeJoinUseCase,
            completeLeaveUseCase,
            legacyPresencePort
        );
        final var session = mock(WebSocketSession.class);
        final var info = sessionInfo();

        when(
            diagramSessionTransportUseCase.join(
                session,
                info.diagramId(),
                info.userId(),
                info.userName()
            )
        ).thenReturn(
            new JoinResult(false, null, null, 0L)
        );

        lifecycle.establish(session, info);

        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verify(diagramSessionTransportUseCase).join(session, info.diagramId(), info.userId(), info.userName());
        verifyNoMoreInteractions(completeJoinUseCase);
        verifyNoMoreInteractions(completeLeaveUseCase);
        verifyNoMoreInteractions(legacyPresencePort);
    }

    @Test
    @DisplayName("join 허용 시 후속 join use case에 결과를 위임한다")
    void establish_whenJoinAccepted_delegatesToJoinCompletion() {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var legacyPresencePort = mock(DiagramLegacyPresencePort.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(
            diagramSessionTransportUseCase,
            completeJoinUseCase,
            completeLeaveUseCase,
            legacyPresencePort
        );
        final var session = mock(WebSocketSession.class);
        final var info = sessionInfo();
        final var joinResult = new JoinResult(true, null, null, 0L);
        when(session.getId()).thenReturn("session-1");

        when(
            diagramSessionTransportUseCase.join(
                session,
                info.diagramId(),
                info.userId(),
                info.userName()
            )
        ).thenReturn(joinResult);

        lifecycle.establish(session, info);

        verify(completeJoinUseCase).complete(
            new DiagramSessionRef("session-1"),
            info.diagramId(),
            new DiagramSessionJoinCompletion(null, null, 0L)
        );
        verifyNoMoreInteractions(completeLeaveUseCase);
        verifyNoMoreInteractions(legacyPresencePort);
    }

    @Test
    @DisplayName("close 시 room 조회가 불가능하면 leave와 후속 leave 처리를 생략한다")
    void close_whenDiagramIdCannotBeResolved_skipsLeave() {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var legacyPresencePort = mock(DiagramLegacyPresencePort.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(
            diagramSessionTransportUseCase,
            completeJoinUseCase,
            completeLeaveUseCase,
            legacyPresencePort
        );
        final var session = mock(WebSocketSession.class);

        when(session.getId()).thenReturn("session-1");
        when(diagramSessionTransportUseCase.close(session, null, null)).thenReturn(null);

        lifecycle.close(session, null);

        verify(diagramSessionTransportUseCase).close(session, null, null);
        verifyNoMoreInteractions(completeLeaveUseCase);
        verifyNoMoreInteractions(completeJoinUseCase);
        verifyNoMoreInteractions(legacyPresencePort);
    }

    @Test
    @DisplayName("close 시 fallback room 조회가 가능하면 leave 결과를 후속 leave use case에 위임한다")
    void close_whenDiagramIdResolvedViaFallback_delegatesToLeaveCompletion() {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var legacyPresencePort = mock(DiagramLegacyPresencePort.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(
            diagramSessionTransportUseCase,
            completeJoinUseCase,
            completeLeaveUseCase,
            legacyPresencePort
        );
        final var session = mock(WebSocketSession.class);
        final var leaveResult = new LeaveResult(false, new byte[0], null, null, 0L);

        when(session.getId()).thenReturn("session-1");
        when(diagramSessionTransportUseCase.close(session, null, null)).thenReturn(
            new DiagramSessionCloseResult(100L, leaveResult)
        );

        lifecycle.close(session, null);

        verify(diagramSessionTransportUseCase).close(session, null, null);
        verify(completeLeaveUseCase).complete(
            new DiagramSessionRef("session-1"),
            100L,
            new DiagramSessionLeaveCompletion(false, new byte[0], null, null, 0L)
        );
        verifyNoMoreInteractions(completeJoinUseCase);
        verifyNoMoreInteractions(legacyPresencePort);
    }

    @Test
    @DisplayName("close 시 legacy loginId가 있으면 legacy peer-left 브로드캐스트를 수행한다")
    void close_whenLegacyLoginIdExists_broadcastsLegacyPeerLeft() {
        final var diagramSessionTransportUseCase = mock(DiagramSessionTransportUseCase.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var legacyPresencePort = mock(DiagramLegacyPresencePort.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(
            diagramSessionTransportUseCase,
            completeJoinUseCase,
            completeLeaveUseCase,
            legacyPresencePort
        );
        final var session = mock(WebSocketSession.class);
        final var info = sessionInfo();
        final var leaveResult = new LeaveResult(false, new byte[0], "epoch-1", "user-1", 3L);

        when(session.getId()).thenReturn("session-1");
        when(diagramSessionTransportUseCase.close(session, info.diagramId(), info.userId())).thenReturn(
            new DiagramSessionCloseResult(info.diagramId(), leaveResult)
        );

        lifecycle.close(session, info);

        verify(completeLeaveUseCase).complete(
            new DiagramSessionRef("session-1"),
            info.diagramId(),
            new DiagramSessionLeaveCompletion(false, new byte[0], "epoch-1", "user-1", 3L)
        );
        verify(legacyPresencePort).broadcastPeerLeftLegacy(info.diagramId(), new DiagramSessionRef("session-1"), info.loginId());
        verifyNoMoreInteractions(completeJoinUseCase);
    }

    private DiagramWebSocketSessionInfo sessionInfo() {
        return new DiagramWebSocketSessionInfo(
            "user-1",
            "login-1",
            "User 1",
            new com.smarterd.collaboration.channel.CollaborationResourceKey("diagram", "100"),
            100L,
            Instant.now().plusSeconds(60),
            1
        );
    }
}
