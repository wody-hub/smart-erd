package com.smarterd.domain.diagram.websocket;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 세션별 메시지/요청 rate limit 상태를 관리하는 내부 저장소.
 */
final class DiagramSessionRateLimiter {

    /** 세션별 rate limit 윈도우 상태. */
    private record RateLimitWindow(long startMillis, int count) {}

    /** minute 윈도우 상태 (presence snapshot 재요청 rate limit 전용). */
    private record MinuteWindow(long startMillis, int count) {}

    private final int maxSnapshotRequestsPerMinute;

    /** 세션별 rate limit 상태 (세션 ID → 윈도우 AtomicReference) */
    private final Map<String, AtomicReference<RateLimitWindow>> rateLimitState = new ConcurrentHashMap<>();

    /** 세션별 presence snapshot 재요청 rate limit 상태 */
    private final Map<String, AtomicReference<MinuteWindow>> snapshotRequestState = new ConcurrentHashMap<>();

    DiagramSessionRateLimiter(int maxSnapshotRequestsPerMinute) {
        this.maxSnapshotRequestsPerMinute = maxSnapshotRequestsPerMinute;
    }

    /**
     * 세션별 초당 메시지 수 제한을 검사한다.
     * CAS 루프로 윈도우 전환과 카운터 증가를 원자적으로 수행한다.
     *
     * @param sessionId            세션 ID
     * @param maxMessagesPerSecond 초당 최대 허용 메시지 수
     * @return 제한 이내이면 true, 초과 시 false
     */
    boolean checkRateLimit(String sessionId, int maxMessagesPerSecond) {
        final var now = System.currentTimeMillis();
        final var ref = rateLimitState.computeIfAbsent(sessionId, (k) ->
            new AtomicReference<>(new RateLimitWindow(now, 0))
        );

        while (true) {
            final var current = ref.get();
            RateLimitWindow next;
            if (now - current.startMillis() > 1000) {
                // 새 윈도우 시작
                next = new RateLimitWindow(now, 1);
            } else {
                if (current.count() >= maxMessagesPerSecond) {
                    return false;
                }
                next = new RateLimitWindow(current.startMillis(), current.count() + 1);
            }
            if (ref.compareAndSet(current, next)) {
                return true;
            }
            // CAS 실패: 다른 스레드가 업데이트 → 재시도
        }
    }

    /**
     * presence snapshot 재요청 rate limit을 검사한다.
     *
     * @param sessionId 세션 ID
     * @return 허용 여부
     */
    boolean allowPresenceSnapshotRequest(String sessionId) {
        final var now = System.currentTimeMillis();
        final var ref = snapshotRequestState.computeIfAbsent(sessionId, (k) ->
            new AtomicReference<>(new MinuteWindow(now, 0))
        );

        while (true) {
            final var current = ref.get();
            MinuteWindow next;
            if (now - current.startMillis() > 60000) {
                next = new MinuteWindow(now, 1);
            } else {
                if (current.count() >= maxSnapshotRequestsPerMinute) {
                    return false;
                }
                next = new MinuteWindow(current.startMillis(), current.count() + 1);
            }
            if (ref.compareAndSet(current, next)) {
                return true;
            }
        }
    }

    /**
     * 세션의 rate limit 상태를 정리한다.
     *
     * @param sessionId 세션 ID
     */
    void cleanup(String sessionId) {
        rateLimitState.remove(sessionId);
        snapshotRequestState.remove(sessionId);
    }
}
