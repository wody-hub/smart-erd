package com.smarterd.domain.diagram.websocket;

import com.smarterd.config.WebSocketProperties;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 ID별 WebSocket 세션 방(room)을 관리한다.
 *
 * <p>같은 다이어그램을 편집 중인 사용자들의 세션을 그룹핑하고,
 * 메시지를 같은 방의 다른 세션에 브로드캐스트한다.
 * Yjs update를 누적 저장하여 주기적/퇴장 시 DB에 병합 저장한다.</p>
 */
@Component
@RequiredArgsConstructor
public class DiagramRoomManager {

    private static final Logger log = LoggerFactory.getLogger(DiagramRoomManager.class);

    /** WebSocket 설정 프로퍼티 */
    private final WebSocketProperties webSocketProperties;

    /** 다이어그램 ID → 접속 중인 WebSocket 세션 집합 */
    private final Map<Long, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    /** 다이어그램 ID → 누적된 Yjs update 바이트 배열 리스트 */
    private final Map<Long, List<byte[]>> accumulatedUpdates = new ConcurrentHashMap<>();

    /** 스냅샷이 변경되었지만 아직 DB에 저장되지 않은 다이어그램 ID 집합 */
    private final Set<Long> dirtyDiagramIds = ConcurrentHashMap.newKeySet();

    /** dirty 집합 복합 연산 동기화 전용 락 */
    private final Object dirtyLock = new Object();

    /** 세션별 rate limit 카운터 (세션 ID → 카운터) */
    private final Map<String, AtomicInteger> rateLimitCounters = new ConcurrentHashMap<>();

    /** 세션별 rate limit 윈도우 시작 시간 (세션 ID → epoch millis) */
    private final Map<String, AtomicLong> rateLimitWindows = new ConcurrentHashMap<>();

    /** 세션별 전송 동기화 락 객체 (세션 ID → 락) */
    private final Map<String, Object> sessionLocks = new ConcurrentHashMap<>();

    /** 다이어그램별 flush 동기화 락 (@Scheduled flush와 연결 종료 flush 간 레이스 방지) */
    private final Map<Long, Object> flushLocks = new ConcurrentHashMap<>();

    /**
     * 세션을 해당 다이어그램 방에 입장시킨다.
     * 방당 최대 세션 수를 초과하면 입장을 거부한다.
     *
     * @param diagramId 다이어그램 ID
     * @param session   WebSocket 세션
     * @return 입장 성공 여부 (false면 최대 인원 초과)
     */
    public boolean join(Long diagramId, WebSocketSession session) {
        final var sessions = rooms.computeIfAbsent(diagramId, (k) -> ConcurrentHashMap.newKeySet());
        // size() + add() 원자성 보장: TOCTOU 레이스 방지
        synchronized (sessions) {
            if (sessions.size() >= webSocketProperties.getMaxSessionsPerRoom()) {
                log.warn(
                    "다이어그램 {} 방 입장 거부: 최대 인원({}) 초과",
                    diagramId,
                    webSocketProperties.getMaxSessionsPerRoom()
                );
                return false;
            }
            sessions.add(session);
        }
        sessionLocks.computeIfAbsent(session.getId(), (k) -> new Object());
        log.info("다이어그램 {} 방 입장: {} (현재 {}명)", diagramId, session.getId(), sessions.size());
        return true;
    }

    /**
     * 세션을 해당 다이어그램 방에서 퇴장시킨다.
     *
     * @param diagramId 다이어그램 ID
     * @param session   WebSocket 세션
     * @return 방이 비었으면 true (마지막 사용자 퇴장)
     */
    public boolean leave(Long diagramId, WebSocketSession session) {
        final var sessions = rooms.get(diagramId);
        if (sessions == null) {
            return true;
        }

        sessionLocks.remove(session.getId());

        // remove + isEmpty + rooms.remove 원자성 보장: join()과의 TOCTOU 레이스 방지
        synchronized (sessions) {
            sessions.remove(session);
            log.info("다이어그램 {} 방 퇴장: {} (남은 {}명)", diagramId, session.getId(), sessions.size());

            if (sessions.isEmpty()) {
                // CAS: 동일 sessions 인스턴스일 때만 제거 (다른 스레드가 새 Set으로 교체했으면 무시)
                rooms.remove(diagramId, sessions);
                return true;
            }
        }
        return false;
    }

    /**
     * 같은 방의 다른 모든 세션에 바이너리 메시지를 브로드캐스트한다.
     *
     * @param diagramId 다이어그램 ID
     * @param sender    발신 세션 (자신에게는 전송하지 않음)
     * @param message   전송할 바이너리 메시지
     */
    @SuppressWarnings("null")
    public void broadcast(Long diagramId, WebSocketSession sender, BinaryMessage message) {
        final var sessions = rooms.getOrDefault(diagramId, Set.of());
        for (final var session : sessions) {
            if (session.equals(sender) || !session.isOpen()) {
                continue;
            }
            try {
                final var lock = getSessionLock(session);
                synchronized (lock) {
                    session.sendMessage(message);
                }
            } catch (Exception e) {
                log.warn("메시지 전송 실패 (세션 {})", session.getId(), e);
            }
        }
    }

    /**
     * 세션별 초당 메시지 수 제한을 검사한다.
     *
     * @param session WebSocket 세션
     * @return 제한 이내이면 true, 초과 시 false
     */
    public boolean checkRateLimit(WebSocketSession session) {
        final var sessionId = session.getId();
        final var now = System.currentTimeMillis();

        final var window = rateLimitWindows.computeIfAbsent(sessionId, (k) -> new AtomicLong(now));
        final var counter = rateLimitCounters.computeIfAbsent(sessionId, (k) -> new AtomicInteger(0));

        // CAS로 윈도우 전환 원자화: 하나의 스레드만 리셋에 성공
        final var windowStart = window.get();
        if (now - windowStart > 1000 && window.compareAndSet(windowStart, now)) {
            counter.set(1);
            return true;
            // CAS 실패: 다른 스레드가 이미 리셋 → 리셋 후 카운터로 계속
        }

        return counter.incrementAndGet() <= webSocketProperties.getMaxMessagesPerSecond();
    }

    /**
     * 세션별 전송 동기화 락 객체를 반환한다.
     * 세션에 대한 동시 sendMessage 호출을 직렬화하기 위해 사용한다.
     *
     * @param session WebSocket 세션
     * @return 해당 세션의 전용 락 객체
     */
    public Object getSessionLock(WebSocketSession session) {
        return sessionLocks.computeIfAbsent(session.getId(), (k) -> new Object());
    }

    /**
     * 다이어그램별 flush 동기화 락 객체를 반환한다.
     * {@code @Scheduled} flush와 연결 종료 시 flush가 동시에 실행되는 것을 방지한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 해당 다이어그램의 전용 flush 락 객체
     */
    public Object getFlushLock(Long diagramId) {
        return flushLocks.computeIfAbsent(diagramId, (k) -> new Object());
    }

    /**
     * 세션의 rate limit 상태를 정리한다.
     * 연결 종료 시 호출한다.
     *
     * @param session WebSocket 세션
     */
    public void cleanupRateLimit(WebSocketSession session) {
        final var sessionId = session.getId();
        rateLimitCounters.remove(sessionId);
        rateLimitWindows.remove(sessionId);
    }

    /**
     * Yjs update를 누적 리스트에 추가한다.
     * 타입 바이트(0x03)를 제외한 순수 Yjs update 바이트를 전달해야 한다.
     *
     * @param diagramId 다이어그램 ID
     * @param update    순수 Yjs update 바이트 배열 (타입 바이트 제외)
     */
    public void appendUpdate(Long diagramId, byte[] update) {
        accumulatedUpdates
            .computeIfAbsent(diagramId, (k) -> Collections.synchronizedList(new ArrayList<>()))
            .add(update);
        synchronized (dirtyLock) {
            dirtyDiagramIds.add(diagramId);
        }
    }

    /**
     * 누적된 Yjs update들을 원자적으로 drain(추출 + 비움)하고 단일 바이트 배열로 병합한다.
     * drain 이후 새로 추가되는 update는 새 리스트에 누적된다.
     *
     * @param diagramId 다이어그램 ID
     * @return 병합된 바이트 배열, 누적 데이터가 없으면 빈 배열
     */
    public byte[] drainAndMergeUpdates(Long diagramId) {
        final var updates = accumulatedUpdates.get(diagramId);
        if (updates == null || updates.isEmpty()) {
            return new byte[0];
        }

        final List<byte[]> drained;
        synchronized (updates) {
            drained = new ArrayList<>(updates);
            updates.clear();
        }

        if (drained.isEmpty()) {
            return new byte[0];
        }
        return YjsUpdateFormat.encode(drained);
    }

    /**
     * 다이어그램 방 해산 시 관련 인메모리 리소스를 정리한다.
     * 마지막 사용자 퇴장 후 flush 완료 시점에 호출한다.
     *
     * @param diagramId 다이어그램 ID
     */
    public void cleanupDiagramResources(Long diagramId) {
        accumulatedUpdates.remove(diagramId);
        flushLocks.remove(diagramId);
    }

    /**
     * 해당 다이어그램에 누적된 update가 있는지 확인한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 누적 update 존재 여부
     */
    public boolean hasUpdates(Long diagramId) {
        final var updates = accumulatedUpdates.get(diagramId);
        return updates != null && !updates.isEmpty();
    }

    /**
     * 다이어그램을 다시 dirty 상태로 표시한다.
     * flush 실패 시 재시도를 위해 사용한다.
     *
     * @param diagramId 다이어그램 ID
     */
    public void reDirty(Long diagramId) {
        synchronized (dirtyLock) {
            dirtyDiagramIds.add(diagramId);
        }
    }

    /**
     * 변경되었지만 아직 DB에 저장되지 않은 다이어그램 ID를 원자적으로 반환하고 dirty 상태를 초기화한다.
     *
     * @return dirty 다이어그램 ID 집합
     */
    public Set<Long> getDirtyIdsAndClear() {
        synchronized (dirtyLock) {
            final var ids = Set.copyOf(dirtyDiagramIds);
            dirtyDiagramIds.clear();
            return ids;
        }
    }

    /**
     * 해당 다이어그램 방의 현재 접속자 수를 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 접속자 수
     */
    public int getSessionCount(Long diagramId) {
        return rooms.getOrDefault(diagramId, Set.of()).size();
    }

    /**
     * 해당 다이어그램 방의 모든 세션을 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 세션 집합 (없으면 빈 집합)
     */
    public Set<WebSocketSession> getSessions(Long diagramId) {
        return rooms.getOrDefault(diagramId, Set.of());
    }
}
