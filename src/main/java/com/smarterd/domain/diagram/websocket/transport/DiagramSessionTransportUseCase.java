package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

/**
 * WebSocket transport 계층에서 필요한 room/session 연산을 조정한다.
 */
@Component
@RequiredArgsConstructor
public class DiagramSessionTransportUseCase {

    private final DiagramRoomManager roomManager;

    /**
     * 세션을 room에 입장시킨다.
     *
     * @param session WebSocket 세션
     * @param diagramId 다이어그램 ID
     * @param userId 사용자 ID
     * @param userName 사용자 표시 이름
     * @return room join 결과
     */
    public JoinResult join(WebSocketSession session, Long diagramId, String userId, String userName) {
        return roomManager.join(diagramId, session, userId, userName);
    }

    /**
     * 수신 메시지 rate limit 통과 여부를 검사한다.
     *
     * @param session WebSocket 세션
     * @return 통과 여부
     */
    public boolean allowMessage(WebSocketSession session) {
        return roomManager.checkRateLimit(session);
    }

    /**
     * 세션 종료 시 room leave와 rate limit 정리를 수행한다.
     *
     * @param session WebSocket 세션
     * @param diagramId 정규화된 다이어그램 ID. 없으면 roomManager 조회 결과로 보완한다.
     * @param userId 정규화된 사용자 ID. 없으면 roomManager 조회 결과로 보완한다.
     * @return 종료 후속 처리에 필요한 결과. room을 찾지 못하면 {@code null}
     */
    @Nullable
    public DiagramSessionCloseResult close(WebSocketSession session, @Nullable Long diagramId, @Nullable String userId) {
        final var sessionId = session.getId();
        roomManager.cleanupRateLimit(sessionId);

        final var resolvedDiagramId = diagramId != null ? diagramId : roomManager.findDiagramIdBySessionId(sessionId);
        if (resolvedDiagramId == null) {
            return null;
        }
        final var resolvedUserId = userId != null ? userId : roomManager.findUserIdBySessionId(sessionId);

        final var leaveResult = roomManager.leave(resolvedDiagramId, session, resolvedUserId);
        return new DiagramSessionCloseResult(resolvedDiagramId, leaveResult);
    }
}
