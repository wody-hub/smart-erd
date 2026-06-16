package com.smarterd.domain.diagram.websocket.room;

import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.websocket.model.JoinRejectionReason;
import com.smarterd.domain.diagram.websocket.model.JoinResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 room 입장 오케스트레이션을 담당한다.
 */
@Slf4j
final class DiagramRoomJoinSupport {

    private final WebSocketProperties webSocketProperties;
    private final DiagramSessionRegistry sessionRegistry;
    private final DiagramPresenceManager presenceManager;

    /**
     * @param webSocketProperties WebSocket 설정
     * @param sessionRegistry 세션 저장소
     * @param presenceManager presence 상태 관리자
     */
    DiagramRoomJoinSupport(
        WebSocketProperties webSocketProperties,
        DiagramSessionRegistry sessionRegistry,
        DiagramPresenceManager presenceManager
    ) {
        this.webSocketProperties = webSocketProperties;
        this.sessionRegistry = sessionRegistry;
        this.presenceManager = presenceManager;
    }

    /**
     * 세션을 해당 다이어그램 방에 입장시킨다.
     *
     * @param diagramId 다이어그램 ID
     * @param session WebSocket 세션
     * @param userId 사용자 ID
     * @param displayName 사용자 표시 이름
     * @return 입장 결과
     */
    JoinResult join(Long diagramId, WebSocketSession session, String userId, String displayName) {
        if (!tryAcquireConnection(userId)) {
            return new JoinResult(false, JoinRejectionReason.CONNECTION_LIMIT_EXCEEDED, null, null, 0);
        }

        final var sessions = sessionRegistry.getOrCreateSessions(diagramId);
        final DiagramPresenceManager.PresenceJoinResult presenceJoinResult;
        synchronized (sessions) {
            if (sessions.size() >= webSocketProperties.getMaxSessionsPerRoom()) {
                return rejectRoomCapacity(diagramId, userId, sessions.size());
            }
            sessions.add(session);
            presenceJoinResult = presenceManager.onJoin(sessions, diagramId, userId, displayName);
        }

        bindSession(diagramId, session, userId);
        log.info("다이어그램 {} 방 입장: {} (현재 {}명)", diagramId, session.getId(), sessions.size());
        return new JoinResult(
            true,
            null,
            presenceJoinResult.snapshot(),
            presenceJoinResult.joinedParticipant(),
            presenceJoinResult.joinedPresenceVersion()
        );
    }

    /**
     * 사용자 연결 슬롯을 점유한다.
     *
     * @param userId 사용자 ID
     * @return 연결 가능 여부
     */
    private boolean tryAcquireConnection(String userId) {
        final var acquired = sessionRegistry.tryAcquireUserConnection(
            userId,
            webSocketProperties.getMaxConnectionsPerUser()
        );
        if (!acquired) {
            log.warn(
                "사용자 {} 연결 수 초과 (현재 {}, 최대 {})",
                userId,
                sessionRegistry.getUserConnectionCount(userId),
                webSocketProperties.getMaxConnectionsPerUser()
            );
        }
        return acquired;
    }

    /**
     * room 수용량 초과 입장을 거부한다.
     *
     * @param diagramId 다이어그램 ID
     * @param userId 사용자 ID
     * @param currentSize 현재 room 세션 수
     * @return 입장 거부 결과
     */
    private JoinResult rejectRoomCapacity(Long diagramId, String userId, int currentSize) {
        sessionRegistry.releaseUserConnection(userId);
        log.warn(
            "다이어그램 {} 방 입장 거부: 현재 {}명, 최대 {}명",
            diagramId,
            currentSize,
            webSocketProperties.getMaxSessionsPerRoom()
        );
        return new JoinResult(false, JoinRejectionReason.ROOM_CAPACITY_EXCEEDED, null, null, 0);
    }

    /**
     * 세션 관련 매핑과 락을 등록한다.
     *
     * @param diagramId 다이어그램 ID
     * @param session WebSocket 세션
     * @param userId 사용자 ID
     */
    private void bindSession(Long diagramId, WebSocketSession session, String userId) {
        sessionRegistry.bindSession(session);
        sessionRegistry.ensureSessionLock(session.getId());
        sessionRegistry.bindSessionUser(session.getId(), userId);
        sessionRegistry.bindSessionDiagram(session.getId(), diagramId);
    }
}
