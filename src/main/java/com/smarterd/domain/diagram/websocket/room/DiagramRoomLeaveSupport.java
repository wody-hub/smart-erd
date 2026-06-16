package com.smarterd.domain.diagram.websocket.room;

import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 room 퇴장 오케스트레이션을 담당한다.
 */
@Slf4j
final class DiagramRoomLeaveSupport {

    private final DiagramSessionRegistry sessionRegistry;
    private final DiagramPresenceManager presenceManager;
    private final DiagramUpdateBuffer updateBuffer;

    /**
     * @param sessionRegistry 세션 저장소
     * @param presenceManager presence 상태 관리자
     * @param updateBuffer update 누적 버퍼
     */
    DiagramRoomLeaveSupport(
        DiagramSessionRegistry sessionRegistry,
        DiagramPresenceManager presenceManager,
        DiagramUpdateBuffer updateBuffer
    ) {
        this.sessionRegistry = sessionRegistry;
        this.presenceManager = presenceManager;
        this.updateBuffer = updateBuffer;
    }

    /**
     * 세션을 해당 다이어그램 방에서 퇴장시킨다.
     *
     * @param diagramId 다이어그램 ID
     * @param session WebSocket 세션
     * @param userId 사용자 ID
     * @return 퇴장 결과
     */
    LeaveResult leave(Long diagramId, WebSocketSession session, String userId) {
        final var sessions = sessionRegistry.getSessions(diagramId);
        if (sessions == null) {
            return leaveMissingRoom(diagramId, session);
        }

        synchronized (sessions) {
            if (!sessions.remove(session)) {
                return emptyResult();
            }
            final var effectiveUserId = resolveEffectiveUserId(session, userId);
            cleanupSessionMapping(diagramId, session, effectiveUserId, sessions.size());
            final var presenceLeaveResult = leavePresence(diagramId, effectiveUserId, sessions);
            if (sessions.isEmpty()) {
                return leaveEmptyRoom(diagramId, sessions, presenceLeaveResult);
            }
            return new LeaveResult(
                false,
                new byte[0],
                presenceLeaveResult.roomEpoch(),
                presenceLeaveResult.leftUserId(),
                presenceLeaveResult.leftPresenceVersion()
            );
        }
    }

    /**
     * room이 없는 퇴장 요청을 처리한다.
     *
     * @param diagramId 요청 다이어그램 ID
     * @param session WebSocket 세션
     * @return 퇴장 결과
     */
    private LeaveResult leaveMissingRoom(Long diagramId, WebSocketSession session) {
        final var mappedDiagramId = sessionRegistry.findDiagramIdBySessionId(session.getId());
        if (mappedDiagramId != null && !mappedDiagramId.equals(diagramId)) {
            return emptyResult();
        }

        final var mappedUserId = sessionRegistry.unbindSessionUser(session.getId());
        sessionRegistry.unbindSessionDiagram(session.getId());
        sessionRegistry.removeSessionLock(session.getId());
        sessionRegistry.removeSession(session.getId());
        if (mappedUserId != null) {
            sessionRegistry.releaseUserConnection(mappedUserId);
        }
        return emptyResult();
    }

    /**
     * 세션 매핑과 사용자 연결 수를 정리한다.
     *
     * @param diagramId 다이어그램 ID
     * @param session WebSocket 세션
     * @param effectiveUserId 실제 퇴장 사용자 ID
     * @param remainingCount 남은 세션 수
     */
    private void cleanupSessionMapping(
        Long diagramId,
        WebSocketSession session,
        String effectiveUserId,
        int remainingCount
    ) {
        sessionRegistry.removeSessionLock(session.getId());
        sessionRegistry.removeSession(session.getId());
        sessionRegistry.unbindSessionDiagram(session.getId());
        log.info("다이어그램 {} 방 퇴장: {} (남은 {}명)", diagramId, session.getId(), remainingCount);

        final var unboundUserId = sessionRegistry.unbindSessionUser(session.getId());
        final var userIdToRelease = unboundUserId != null ? unboundUserId : effectiveUserId;
        if (userIdToRelease != null) {
            sessionRegistry.releaseUserConnection(userIdToRelease);
        }
    }

    /**
     * presence 퇴장을 적용한다.
     *
     * @param diagramId 다이어그램 ID
     * @param effectiveUserId 실제 퇴장 사용자 ID
     * @param sessions room 세션 집합
     * @return presence 퇴장 결과
     */
    private DiagramPresenceManager.PresenceLeaveResult leavePresence(
        Long diagramId,
        String effectiveUserId,
        Object sessions
    ) {
        if (effectiveUserId == null) {
            return new DiagramPresenceManager.PresenceLeaveResult(null, null, 0);
        }
        return presenceManager.onLeave(sessions, diagramId, effectiveUserId);
    }

    /**
     * 세션 매핑에 저장된 사용자 ID를 요청 인자보다 우선해 해석한다.
     *
     * @param session WebSocket 세션
     * @param fallbackUserId fallback 사용자 ID
     * @return 실제 사용자 ID
     */
    private String resolveEffectiveUserId(WebSocketSession session, String fallbackUserId) {
        final var mappedUserId = sessionRegistry.getSessionUser(session.getId());
        return mappedUserId != null ? mappedUserId : fallbackUserId;
    }

    /**
     * 마지막 세션 퇴장 시 room 리소스를 정리한다.
     *
     * @param diagramId 다이어그램 ID
     * @param sessions room 세션 집합
     * @param presenceLeaveResult presence 퇴장 결과
     * @return 퇴장 결과
     */
    private LeaveResult leaveEmptyRoom(
        Long diagramId,
        java.util.Set<WebSocketSession> sessions,
        DiagramPresenceManager.PresenceLeaveResult presenceLeaveResult
    ) {
        sessionRegistry.removeRoomIfSame(diagramId, sessions);
        presenceManager.removeRoom(diagramId);
        final var drained = updateBuffer.drainAndMergeUpdates(diagramId);
        updateBuffer.removeDiagram(diagramId);
        return new LeaveResult(
            true,
            drained,
            presenceLeaveResult.roomEpoch(),
            presenceLeaveResult.leftUserId(),
            presenceLeaveResult.leftPresenceVersion()
        );
    }

    /**
     * 상태 변경 없는 퇴장 결과를 반환한다.
     *
     * @return 빈 퇴장 결과
     */
    private LeaveResult emptyResult() {
        return new LeaveResult(false, new byte[0], null, null, 0);
    }
}
