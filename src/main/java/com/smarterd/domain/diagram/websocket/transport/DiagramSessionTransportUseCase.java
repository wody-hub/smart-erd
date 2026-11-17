package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
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
     * drain부터 저장 commit까지 handoff와 공유할 락을 반환한다.
     *
     * @param session 종료 세션
     * @param diagramId 메타데이터의 다이어그램 ID
     * @return 안정적인 flush 락. room 매핑도 없으면 세션 자체
     */
    public Object getCloseLock(WebSocketSession session, @Nullable Long diagramId) {
        final var resolvedId = diagramId != null ? diagramId : roomManager.findDiagramIdBySessionId(session.getId());
        return resolvedId != null ? roomManager.getFlushLock(resolvedId) : session;
    }

    /**
     * peer relay보다 먼저 서버가 수락한 프로토콜 버전을 보고한다.
     *
     * @param session 입장 세션
     */
    public void reportProtocolVersion(WebSocketSession session) {
        final var metadata = session.getAttributes().get(CollaborationAuthenticatedSession.SESSION_ATTR_KEY);
        if (!(metadata instanceof CollaborationAuthenticatedSession info)) {
            return;
        }
        synchronized (roomManager.getSessionLock(session)) {
            try {
                session.sendMessage(
                    new BinaryMessage(
                        new byte[] { DiagramMessageTypes.MSG_PROTOCOL_CAPABILITY, (byte) info.protocolVersion() }
                    )
                );
            } catch (Exception e) {
                throw new IllegalStateException("협업 프로토콜 capability 전송 실패", e);
            }
        }
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
    public DiagramSessionCloseResult close(
        WebSocketSession session,
        @Nullable Long diagramId,
        @Nullable String userId
    ) {
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
