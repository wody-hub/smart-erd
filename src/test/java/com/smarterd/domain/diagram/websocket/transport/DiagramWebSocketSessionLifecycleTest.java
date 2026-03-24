package com.smarterd.domain.diagram.websocket.transport;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.application.diagram.command.CompleteDiagramSessionJoinUseCase;
import com.smarterd.application.diagram.command.CompleteDiagramSessionLeaveUseCase;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
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
        final var roomManager = mock(com.smarterd.domain.diagram.websocket.room.DiagramRoomManager.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(roomManager, completeJoinUseCase, completeLeaveUseCase);
        final var session = mock(WebSocketSession.class);
        final var info = sessionInfo();

        when(roomManager.join(info.diagramId(), session, info.userId(), info.userName())).thenReturn(
            new JoinResult(false, null, null, 0L)
        );

        lifecycle.establish(session, info);

        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verify(roomManager).join(info.diagramId(), session, info.userId(), info.userName());
        verifyNoMoreInteractions(completeJoinUseCase);
        verifyNoMoreInteractions(completeLeaveUseCase);
    }

    @Test
    @DisplayName("join 허용 시 후속 join use case에 결과를 위임한다")
    void establish_whenJoinAccepted_delegatesToJoinCompletion() {
        final var roomManager = mock(com.smarterd.domain.diagram.websocket.room.DiagramRoomManager.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(roomManager, completeJoinUseCase, completeLeaveUseCase);
        final var session = mock(WebSocketSession.class);
        final var info = sessionInfo();
        final var joinResult = new JoinResult(true, null, null, 0L);

        when(roomManager.join(info.diagramId(), session, info.userId(), info.userName())).thenReturn(joinResult);

        lifecycle.establish(session, info);

        verify(completeJoinUseCase).complete(session, info, joinResult);
        verifyNoMoreInteractions(completeLeaveUseCase);
    }

    @Test
    @DisplayName("close 시 room 조회가 불가능하면 leave와 후속 leave 처리를 생략한다")
    void close_whenDiagramIdCannotBeResolved_skipsLeave() {
        final var roomManager = mock(com.smarterd.domain.diagram.websocket.room.DiagramRoomManager.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(roomManager, completeJoinUseCase, completeLeaveUseCase);
        final var session = mock(WebSocketSession.class);

        when(session.getId()).thenReturn("session-1");
        when(roomManager.findDiagramIdBySession(session)).thenReturn(null);

        lifecycle.close(session, null);

        verify(roomManager).cleanupRateLimit(session);
        verify(roomManager).findDiagramIdBySession(session);
        verify(roomManager, never()).leave(any(), eq(session), any());
        verifyNoMoreInteractions(completeLeaveUseCase);
        verifyNoMoreInteractions(completeJoinUseCase);
    }

    @Test
    @DisplayName("close 시 fallback room 조회가 가능하면 leave 결과를 후속 leave use case에 위임한다")
    void close_whenDiagramIdResolvedViaFallback_delegatesToLeaveCompletion() {
        final var roomManager = mock(com.smarterd.domain.diagram.websocket.room.DiagramRoomManager.class);
        final var completeJoinUseCase = mock(CompleteDiagramSessionJoinUseCase.class);
        final var completeLeaveUseCase = mock(CompleteDiagramSessionLeaveUseCase.class);
        final var lifecycle = new DiagramWebSocketSessionLifecycle(roomManager, completeJoinUseCase, completeLeaveUseCase);
        final var session = mock(WebSocketSession.class);
        final var leaveResult = new LeaveResult(false, new byte[0], null, null, 0L);

        when(session.getId()).thenReturn("session-1");
        when(roomManager.findDiagramIdBySession(session)).thenReturn(100L);
        when(roomManager.findUserIdBySession(session)).thenReturn("user-1");
        when(roomManager.leave(100L, session, "user-1")).thenReturn(leaveResult);

        lifecycle.close(session, null);

        verify(roomManager).cleanupRateLimit(session);
        verify(roomManager).leave(100L, session, "user-1");
        verify(completeLeaveUseCase).complete(session, null, 100L, leaveResult);
        verifyNoMoreInteractions(completeJoinUseCase);
    }

    private DiagramWebSocketSessionInfo sessionInfo() {
        return new DiagramWebSocketSessionInfo(
            "user-1",
            "login-1",
            "User 1",
            new CollaborationResourceKey("diagram", "100"),
            100L,
            Instant.now().plusSeconds(60),
            1
        );
    }
}
