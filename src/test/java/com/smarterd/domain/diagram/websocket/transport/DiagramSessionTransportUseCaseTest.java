package com.smarterd.domain.diagram.websocket.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

class DiagramSessionTransportUseCaseTest {

    @Test
    @DisplayName("join은 room manager 결과를 그대로 반환한다")
    void join_returnsRoomManagerResult() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var useCase = new DiagramSessionTransportUseCase(roomManager);
        final var session = mock(WebSocketSession.class);
        final var joinResult = new JoinResult(true, null, null, null, 0L);
        final var diagramId = 100L;
        final var userId = "user-1";
        final var userName = "User 1";

        when(roomManager.join(diagramId, session, userId, userName)).thenReturn(joinResult);

        final var result = useCase.join(session, diagramId, userId, userName);

        assertThat(result).isEqualTo(joinResult);
        verify(roomManager).join(diagramId, session, userId, userName);
        verifyNoMoreInteractions(roomManager);
    }

    @Test
    @DisplayName("allowMessage는 rate limit 검사 결과를 그대로 반환한다")
    void allowMessage_returnsRateLimitResult() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var useCase = new DiagramSessionTransportUseCase(roomManager);
        final var session = mock(WebSocketSession.class);
        when(roomManager.checkRateLimit(session)).thenReturn(true);

        final var result = useCase.allowMessage(session);

        assertThat(result).isTrue();
        verify(roomManager).checkRateLimit(session);
        verifyNoMoreInteractions(roomManager);
    }

    @Test
    @DisplayName("close는 fallback room 조회와 leave 결과를 묶어 반환한다")
    void close_returnsLeaveResultWithDiagramId() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var useCase = new DiagramSessionTransportUseCase(roomManager);
        final var session = mock(WebSocketSession.class);
        final var leaveResult = new LeaveResult(false, new byte[0], null, null, 0L);
        when(session.getId()).thenReturn("session-1");

        when(roomManager.findDiagramIdBySessionId("session-1")).thenReturn(100L);
        when(roomManager.findUserIdBySessionId("session-1")).thenReturn("user-1");
        when(roomManager.leave(100L, session, "user-1")).thenReturn(leaveResult);

        final var result = useCase.close(session, null, null);

        assertThat(result).isEqualTo(new DiagramSessionCloseResult(100L, leaveResult));
        verify(roomManager).cleanupRateLimit("session-1");
        verify(roomManager).findDiagramIdBySessionId("session-1");
        verify(roomManager).findUserIdBySessionId("session-1");
        verify(roomManager).leave(100L, session, "user-1");
        verifyNoMoreInteractions(roomManager);
    }

    @Test
    @DisplayName("close는 diagramId를 찾지 못하면 null을 반환한다")
    void close_returnsNullWhenDiagramIdMissing() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var useCase = new DiagramSessionTransportUseCase(roomManager);
        final var session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");

        when(roomManager.findDiagramIdBySessionId("session-1")).thenReturn(null);

        final var result = useCase.close(session, null, null);

        assertThat(result).isNull();
        verify(roomManager).cleanupRateLimit("session-1");
        verify(roomManager).findDiagramIdBySessionId("session-1");
        verifyNoMoreInteractions(roomManager);
    }
}
