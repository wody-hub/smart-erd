package com.smarterd.domain.diagram.websocket.room;

import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.CloseStatus;

/**
 * 다이어그램 room 강제 폐기와 리소스 정리를 담당한다.
 */
@Slf4j
final class DiagramRoomDiscardSupport {

    private final DiagramSessionRegistry sessionRegistry;
    private final DiagramPresenceManager presenceManager;
    private final DiagramUpdateBuffer updateBuffer;
    private final DiagramSessionRateLimiter rateLimiter;

    /**
     * @param sessionRegistry 세션 저장소
     * @param presenceManager presence 상태 관리자
     * @param updateBuffer update 누적 버퍼
     * @param rateLimiter 세션 rate limiter
     */
    DiagramRoomDiscardSupport(
        DiagramSessionRegistry sessionRegistry,
        DiagramPresenceManager presenceManager,
        DiagramUpdateBuffer updateBuffer,
        DiagramSessionRateLimiter rateLimiter
    ) {
        this.sessionRegistry = sessionRegistry;
        this.presenceManager = presenceManager;
        this.updateBuffer = updateBuffer;
        this.rateLimiter = rateLimiter;
    }

    /**
     * 해당 다이어그램 방의 모든 세션을 강제로 닫고 인메모리 리소스를 정리한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void discardRoom(Long diagramId) {
        final var nonNullDiagramId = Objects.requireNonNull(diagramId, "diagramId must not be null");
        final var sessions = sessionRegistry.removeRoom(nonNullDiagramId);
        presenceManager.removeRoom(nonNullDiagramId);
        updateBuffer.removeDiagram(nonNullDiagramId);
        sessionRegistry.removeFlushLock(nonNullDiagramId);

        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        for (final var session : sessions) {
            cleanupSession(session.getId());
            try {
                if (session.isOpen()) {
                    session.close(Objects.requireNonNull(CloseStatus.GOING_AWAY));
                }
            } catch (Exception e) {
                log.warn("방 폐기 시 세션 종료 실패 (세션 {})", session.getId(), e);
            }
        }
        log.info("다이어그램 {} 방 폐기 완료 ({}개 세션)", nonNullDiagramId, sessions.size());
    }

    /**
     * 세션 관련 인메모리 리소스를 정리한다.
     *
     * @param sessionId 세션 ID
     */
    private void cleanupSession(String sessionId) {
        sessionRegistry.removeSessionLock(sessionId);
        sessionRegistry.removeSession(sessionId);
        rateLimiter.cleanup(sessionId);

        final var mappedUserId = sessionRegistry.unbindSessionUser(sessionId);
        sessionRegistry.unbindSessionDiagram(sessionId);
        if (mappedUserId != null) {
            sessionRegistry.releaseUserConnection(mappedUserId);
        }
    }
}
