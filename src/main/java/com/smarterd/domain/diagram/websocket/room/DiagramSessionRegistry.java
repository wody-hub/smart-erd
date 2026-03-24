package com.smarterd.domain.diagram.websocket.room;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 room 세션/락/사용자 연결 카운트를 관리하는 내부 저장소.
 */
final class DiagramSessionRegistry {

    /** 다이어그램 ID → 접속 중인 WebSocket 세션 집합 */
    private final Map<Long, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    /** 세션별 전송 동기화 락 객체 (세션 ID → 락) */
    private final Map<String, Object> sessionLocks = new ConcurrentHashMap<>();

    /** 세션 ID → 실제 WebSocket 세션 */
    private final Map<String, WebSocketSession> sessionsById = new ConcurrentHashMap<>();

    /** 다이어그램별 flush 동기화 락 */
    private final Map<Long, Object> flushLocks = new ConcurrentHashMap<>();

    /** 사용자별 동시 WebSocket 연결 수 (userId → 카운터) */
    private final Map<String, AtomicInteger> userSessionCounts = new ConcurrentHashMap<>();

    /** 세션 ID → 사용자 ID 매핑 */
    private final Map<String, String> sessionUserIds = new ConcurrentHashMap<>();

    /** 세션 ID → 다이어그램 ID 매핑 */
    private final Map<String, Long> sessionDiagramIds = new ConcurrentHashMap<>();

    /**
     * 사용자 연결 슬롯을 점유한다.
     *
     * @param userId         사용자 ID
     * @param maxConnections 허용 최대 연결 수
     * @return 점유 성공 여부
     */
    boolean tryAcquireUserConnection(String userId, int maxConnections) {
        final var userCount = userSessionCounts.computeIfAbsent(userId, (k) -> new AtomicInteger(0));
        if (userCount.incrementAndGet() > maxConnections) {
            userCount.decrementAndGet();
            return false;
        }
        return true;
    }

    /**
     * 사용자 연결 슬롯을 반납한다.
     *
     * @param userId 사용자 ID
     */
    void releaseUserConnection(String userId) {
        final var userCount = userSessionCounts.get(userId);
        if (userCount != null && userCount.decrementAndGet() <= 0) {
            userSessionCounts.remove(userId);
        }
    }

    /**
     * 다이어그램 room 세션 집합을 반환한다. 없으면 새로 생성한다.
     *
     * @param diagramId 다이어그램 ID
     * @return room 세션 집합
     */
    Set<WebSocketSession> getOrCreateSessions(Long diagramId) {
        return rooms.computeIfAbsent(diagramId, (k) -> ConcurrentHashMap.newKeySet());
    }

    /**
     * 다이어그램 room 세션 집합을 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return room 세션 집합. 없으면 {@code null}
     */
    Set<WebSocketSession> getSessions(Long diagramId) {
        return rooms.get(diagramId);
    }

    /**
     * 다이어그램 room 세션 집합을 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return room 세션 집합. 없으면 빈 집합
     */
    Set<WebSocketSession> getSessionsOrEmpty(Long diagramId) {
        return rooms.getOrDefault(diagramId, Set.of());
    }

    /**
     * room 세션 집합이 동일 인스턴스일 때만 room을 제거한다.
     *
     * @param diagramId 다이어그램 ID
     * @param sessions  기대하는 세션 집합 인스턴스
     */
    void removeRoomIfSame(Long diagramId, Set<WebSocketSession> sessions) {
        rooms.remove(diagramId, sessions);
    }

    /**
     * room을 제거하고 세션 집합을 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 제거된 세션 집합
     */
    Set<WebSocketSession> removeRoom(Long diagramId) {
        return rooms.remove(diagramId);
    }

    /**
     * 세션 전송 락을 미리 생성한다.
     *
     * @param sessionId 세션 ID
     */
    void ensureSessionLock(String sessionId) {
        sessionLocks.computeIfAbsent(sessionId, (k) -> new Object());
    }

    /**
     * 세션 ID와 실제 세션 객체 매핑을 등록한다.
     *
     * @param session WebSocket 세션
     */
    void bindSession(WebSocketSession session) {
        sessionsById.put(session.getId(), session);
    }

    /**
     * 세션 전송 락을 반환한다.
     *
     * @param session WebSocket 세션
     * @return 세션 전송 락
     */
    Object getSessionLock(WebSocketSession session) {
        return sessionLocks.computeIfAbsent(session.getId(), (k) -> new Object());
    }

    /**
     * 세션 전송 락을 제거한다.
     *
     * @param sessionId 세션 ID
     */
    void removeSessionLock(String sessionId) {
        sessionLocks.remove(sessionId);
    }

    /**
     * 세션 ID로 실제 WebSocket 세션을 조회한다.
     *
     * @param sessionId 세션 ID
     * @return 세션 객체. 없으면 {@code null}
     */
    WebSocketSession getSession(String sessionId) {
        return sessionsById.get(sessionId);
    }

    /**
     * 세션 ID와 실제 세션 매핑을 제거한다.
     *
     * @param sessionId 세션 ID
     */
    void removeSession(String sessionId) {
        sessionsById.remove(sessionId);
    }

    /**
     * 세션과 사용자 매핑을 등록한다.
     *
     * @param sessionId 세션 ID
     * @param userId    사용자 ID
     */
    void bindSessionUser(String sessionId, String userId) {
        sessionUserIds.put(sessionId, userId);
    }

    /**
     * 세션-사용자 매핑을 제거하고 사용자 ID를 반환한다.
     *
     * @param sessionId 세션 ID
     * @return 매핑된 사용자 ID (없으면 {@code null})
     */
    String unbindSessionUser(String sessionId) {
        return sessionUserIds.remove(sessionId);
    }

    /**
     * 세션과 다이어그램 매핑을 등록한다.
     *
     * @param sessionId 세션 ID
     * @param diagramId 다이어그램 ID
     */
    void bindSessionDiagram(String sessionId, Long diagramId) {
        sessionDiagramIds.put(sessionId, diagramId);
    }

    /**
     * 세션-다이어그램 매핑을 제거하고 다이어그램 ID를 반환한다.
     *
     * @param sessionId 세션 ID
     * @return 매핑된 다이어그램 ID (없으면 {@code null})
     */
    Long unbindSessionDiagram(String sessionId) {
        return sessionDiagramIds.remove(sessionId);
    }

    /**
     * 세션에 매핑된 사용자 ID를 조회한다.
     *
     * @param sessionId 세션 ID
     * @return 매핑된 사용자 ID (없으면 {@code null})
     */
    String getSessionUser(String sessionId) {
        return sessionUserIds.get(sessionId);
    }

    Long findDiagramIdBySessionId(String sessionId) {
        return sessionDiagramIds.get(sessionId);
    }

    /**
     * 다이어그램 flush 락을 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return flush 락
     */
    Object getFlushLock(Long diagramId) {
        return flushLocks.computeIfAbsent(diagramId, (k) -> new Object());
    }

    /**
     * 다이어그램 flush 락을 제거한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void removeFlushLock(Long diagramId) {
        flushLocks.remove(diagramId);
    }

    /**
     * room의 현재 세션 수를 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 세션 수
     */
    int getSessionCount(Long diagramId) {
        return getSessionsOrEmpty(diagramId).size();
    }
}
