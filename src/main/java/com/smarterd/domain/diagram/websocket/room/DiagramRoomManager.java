package com.smarterd.domain.diagram.websocket.room;

import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import com.smarterd.domain.diagram.websocket.model.PresenceSnapshot;
import java.util.Objects;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 ID별 WebSocket room facade.
 */
@Component
public class DiagramRoomManager {

    private static final int MAX_SNAPSHOT_REQUESTS_PER_MINUTE = 6;

    private final WebSocketProperties webSocketProperties;
    private final DiagramSessionRegistry sessionRegistry;
    private final DiagramPresenceManager presenceManager;
    private final DiagramSessionRateLimiter rateLimiter;
    private final DiagramRoomJoinSupport joinSupport;
    private final DiagramRoomLeaveSupport leaveSupport;
    private final DiagramRoomBroadcastSupport broadcastSupport;
    private final DiagramRoomDiscardSupport discardSupport;
    private final DiagramRoomUpdateSupport updateSupport;

    /**
     * @param webSocketProperties WebSocket 설정
     */
    @Autowired
    public DiagramRoomManager(WebSocketProperties webSocketProperties) {
        this(
            webSocketProperties,
            new DiagramSessionRegistry(),
            new DiagramPresenceManager(),
            new DiagramUpdateBuffer(),
            new DiagramSessionRateLimiter(MAX_SNAPSHOT_REQUESTS_PER_MINUTE)
        );
    }

    DiagramRoomManager(
        WebSocketProperties webSocketProperties,
        DiagramSessionRegistry sessionRegistry,
        DiagramPresenceManager presenceManager,
        DiagramUpdateBuffer updateBuffer,
        DiagramSessionRateLimiter rateLimiter
    ) {
        this.webSocketProperties = webSocketProperties;
        this.sessionRegistry = sessionRegistry;
        this.presenceManager = presenceManager;
        this.rateLimiter = rateLimiter;
        this.joinSupport = new DiagramRoomJoinSupport(webSocketProperties, sessionRegistry, presenceManager);
        this.leaveSupport = new DiagramRoomLeaveSupport(sessionRegistry, presenceManager, updateBuffer);
        this.broadcastSupport = new DiagramRoomBroadcastSupport(sessionRegistry);
        this.discardSupport = new DiagramRoomDiscardSupport(
            sessionRegistry,
            presenceManager,
            updateBuffer,
            rateLimiter
        );
        this.updateSupport = new DiagramRoomUpdateSupport(webSocketProperties, sessionRegistry, updateBuffer);
    }

    /** @param diagramId 다이어그램 ID @param session 세션 @param userId 사용자 ID @param displayName 표시 이름 @return 입장 결과 */
    public JoinResult join(Long diagramId, WebSocketSession session, String userId, String displayName) {
        return joinSupport.join(diagramId, session, userId, displayName);
    }

    /** @param diagramId 다이어그램 ID @param session 세션 @param userId 사용자 ID @return 퇴장 결과 */
    public LeaveResult leave(Long diagramId, WebSocketSession session, String userId) {
        return leaveSupport.leave(diagramId, session, userId);
    }

    /** @param diagramId 다이어그램 ID @return presence snapshot */
    public PresenceSnapshot getPresenceSnapshot(Long diagramId) {
        final var sessions = sessionRegistry.getSessions(diagramId);
        if (sessions == null) {
            return null;
        }
        synchronized (sessions) {
            return presenceManager.getPresenceSnapshot(sessions, diagramId);
        }
    }

    /** @param diagramId 다이어그램 ID @param senderSessionId 발신 세션 ID @param message 메시지 */
    public void broadcast(@NonNull Long diagramId, @NonNull String senderSessionId, @NonNull BinaryMessage message) {
        broadcastSupport.broadcast(diagramId, senderSessionId, message);
    }

    /** @param session 세션 @return 제한 이내 여부 */
    public boolean checkRateLimit(WebSocketSession session) {
        return rateLimiter.checkRateLimit(session.getId(), webSocketProperties.getMaxMessagesPerSecond());
    }

    /** @param sessionId 세션 ID @return presence snapshot 요청 허용 여부 */
    public boolean allowPresenceSnapshotRequest(String sessionId) {
        return rateLimiter.allowPresenceSnapshotRequest(sessionId);
    }

    /** @param session 세션 @return 세션 전송 락 */
    public Object getSessionLock(WebSocketSession session) {
        return sessionRegistry.getSessionLock(session);
    }

    /** @param diagramId 다이어그램 ID @return flush 락 */
    public Object getFlushLock(Long diagramId) {
        return sessionRegistry.getFlushLock(diagramId);
    }

    /** @param diagramId 다이어그램 ID */
    public void removeFlushLock(Long diagramId) {
        sessionRegistry.removeFlushLock(diagramId);
    }

    /** @param sessionId 세션 ID */
    public void cleanupRateLimit(String sessionId) {
        rateLimiter.cleanup(sessionId);
    }

    /** @param diagramId 다이어그램 ID @param update update 바이트 @return 추가 성공 여부 */
    public boolean appendUpdate(Long diagramId, byte[] update) {
        return updateSupport.appendUpdate(diagramId, update);
    }

    /** @param diagramId 다이어그램 ID @return 단독 접속이면 drain된 update, 아니면 null */
    public byte[] drainIfAlone(Long diagramId) {
        return updateSupport.drainIfAlone(diagramId);
    }

    /** @param diagramId 다이어그램 ID @return drain된 병합 update */
    public byte[] drainAndMergeUpdates(Long diagramId) {
        return updateSupport.drainAndMergeUpdates(diagramId);
    }

    /** @param diagramId 다이어그램 ID @return 현재 누적 update 병합본 */
    public byte[] peekMergedUpdates(Long diagramId) {
        return updateSupport.peekMergedUpdates(diagramId);
    }

    /** @param diagramId 다이어그램 ID @param mergedUpdates 병합 update @return 복원 성공 여부 */
    public boolean restoreUpdates(Long diagramId, byte[] mergedUpdates) {
        return updateSupport.restoreUpdates(diagramId, mergedUpdates);
    }

    /** @param diagramId 다이어그램 ID @param update 최신 update */
    public void replaceUpdates(Long diagramId, byte[] update) {
        updateSupport.replaceUpdates(diagramId, update);
    }

    /** @param sessionId 세션 ID @return 사용자 ID */
    public String findUserIdBySessionId(String sessionId) {
        return sessionRegistry.getSessionUser(sessionId);
    }

    /** @param sessionId 세션 ID @return 다이어그램 ID */
    public Long findDiagramIdBySessionId(String sessionId) {
        return sessionRegistry.findDiagramIdBySessionId(sessionId);
    }

    /** @param sessionId 세션 ID @return WebSocket 세션 */
    public WebSocketSession getSession(String sessionId) {
        return sessionRegistry.getSession(sessionId);
    }

    /** @param diagramId 다이어그램 ID @return 누적 update 존재 여부 */
    public boolean hasUpdates(Long diagramId) {
        return updateSupport.hasUpdates(diagramId);
    }

    /** @param diagramId 다이어그램 ID */
    public void reDirty(Long diagramId) {
        updateSupport.reDirty(diagramId);
    }

    /** @return dirty 다이어그램 ID 집합 */
    public Set<Long> getDirtyIdsAndClear() {
        return updateSupport.getDirtyIdsAndClear();
    }

    /** @return 누적 update가 있는 모든 다이어그램 ID */
    public Set<Long> getAllDiagramIdsWithUpdates() {
        return updateSupport.getAllDiagramIdsWithUpdates();
    }

    /** @param diagramId 다이어그램 ID @return 접속 세션 수 */
    public int getSessionCount(Long diagramId) {
        return sessionRegistry.getSessionCount(diagramId);
    }

    /** @param diagramId 다이어그램 ID @return 세션 집합 */
    public Set<WebSocketSession> getSessions(Long diagramId) {
        return sessionRegistry.getSessionsOrEmpty(diagramId);
    }

    /** @param diagramId 다이어그램 ID */
    public void discardRoom(@NonNull Long diagramId) {
        discardSupport.discardRoom(Objects.requireNonNull(diagramId, "diagramId must not be null"));
    }
}
