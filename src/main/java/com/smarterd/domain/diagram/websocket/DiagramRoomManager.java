package com.smarterd.domain.diagram.websocket;

import com.smarterd.config.WebSocketProperties;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
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

    /** Presence snapshot 재요청 허용 횟수 (세션당 분당) */
    private static final int MAX_SNAPSHOT_REQUESTS_PER_MINUTE = 6;

    /** WebSocket 설정 프로퍼티 */
    private final WebSocketProperties webSocketProperties;

    /** 다이어그램 ID → 접속 중인 WebSocket 세션 집합 */
    private final Map<Long, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    /** 다이어그램 ID → room 단위 presence 상태 */
    private final Map<Long, PresenceRoomState> presenceRooms = new ConcurrentHashMap<>();

    /** 다이어그램 ID → 누적된 Yjs update 바이트 배열 리스트 */
    private final Map<Long, List<byte[]>> accumulatedUpdates = new ConcurrentHashMap<>();

    /** 다이어그램 ID → 누적 update 총 크기 (바이트) */
    private final Map<Long, AtomicLong> accumulatedSizes = new ConcurrentHashMap<>();

    /** 스냅샷이 변경되었지만 아직 DB에 저장되지 않은 다이어그램 ID 집합 */
    private final Set<Long> dirtyDiagramIds = ConcurrentHashMap.newKeySet();

    /** dirty 집합 복합 연산 동기화 전용 락 */
    private final Object dirtyLock = new Object();

    /** 세션별 전송 동기화 락 객체 (세션 ID → 락) */
    private final Map<String, Object> sessionLocks = new ConcurrentHashMap<>();

    /** 다이어그램별 flush 동기화 락 (@Scheduled flush와 연결 종료 flush 간 레이스 방지) */
    private final Map<Long, Object> flushLocks = new ConcurrentHashMap<>();

    /** 사용자별 동시 WebSocket 연결 수 (userId → 카운터) */
    private final Map<String, AtomicInteger> userSessionCounts = new ConcurrentHashMap<>();

    /** 세션별 presence snapshot 재요청 rate limit 상태 */
    private final Map<String, AtomicReference<MinuteWindow>> snapshotRequestState = new ConcurrentHashMap<>();

    /**
     * 세션별 rate limit 윈도우 상태.
     *
     * @param startMillis 윈도우 시작 시각 (epoch millis)
     * @param count       윈도우 내 메시지 수
     */
    private record RateLimitWindow(long startMillis, int count) {}

    /** 세션별 rate limit 상태 (세션 ID → 윈도우 AtomicReference) */
    private final Map<String, AtomicReference<RateLimitWindow>> rateLimitState = new ConcurrentHashMap<>();

    /** minute 윈도우 상태 (snapshot 재요청 rate limit 전용). */
    private record MinuteWindow(long startMillis, int count) {}

    /** room 내부 사용자 presence 엔트리. sessions 락에서만 접근한다. */
    private static final class PresenceEntry {
        private final String userId;
        private String displayName;
        private final long joinSeq;
        private int sessionCount;

        private PresenceEntry(String userId, String displayName, long joinSeq) {
            this.userId = userId;
            this.displayName = displayName;
            this.joinSeq = joinSeq;
            this.sessionCount = 1;
        }
    }

    /** room presence 상태. sessions 락에서만 접근한다. */
    private static final class PresenceRoomState {
        private final String roomEpoch = UUID.randomUUID().toString();
        private final AtomicLong presenceVersion = new AtomicLong(0);
        private final AtomicLong joinSeqGenerator = new AtomicLong(0);
        private final Map<String, PresenceEntry> entries = new HashMap<>();
    }

    /** 참여자 정보 payload. */
    public record PresenceParticipant(String userId, String displayName, long joinSeq) {}

    /** presence snapshot payload. */
    public record PresenceSnapshot(String roomEpoch, long presenceVersion, List<PresenceParticipant> participants) {}

    /** join 반환 결과. */
    public record JoinResult(
        boolean accepted,
        PresenceSnapshot snapshot,
        PresenceParticipant joinedParticipant,
        long joinedPresenceVersion
    ) {}

    /**
     * leave() 반환 결과.
     *
     * @param roomEmpty            방이 비었는지 여부
     * @param drainedUpdates       방이 비었으면 원자적으로 drain된 Yjs update
     * @param roomEpoch            room epoch (없으면 null)
     * @param leftUserId           완전 퇴장한 사용자 ID (없으면 null)
     * @param leftPresenceVersion  완전 퇴장 이벤트 version (없으면 0)
     */
    public record LeaveResult(
        boolean roomEmpty,
        byte[] drainedUpdates,
        String roomEpoch,
        String leftUserId,
        long leftPresenceVersion
    ) {}

    /**
     * 세션을 해당 다이어그램 방에 입장시킨다.
     * 사용자별 연결 수 제한 및 방당 최대 세션 수를 초과하면 입장을 거부한다.
     *
     * @param diagramId   다이어그램 ID
     * @param session     WebSocket 세션
     * @param userId      사용자 ID (불변 식별자)
     * @param displayName 사용자 표시 이름
     * @return 입장 결과
     */
    public JoinResult join(Long diagramId, WebSocketSession session, String userId, String displayName) {
        // 사용자별 연결 수 체크
        final var userCount = userSessionCounts.computeIfAbsent(userId, (k) -> new AtomicInteger(0));
        if (userCount.incrementAndGet() > webSocketProperties.getMaxConnectionsPerUser()) {
            userCount.decrementAndGet();
            log.warn("사용자 {} 연결 수 초과 (최대 {})", userId, webSocketProperties.getMaxConnectionsPerUser());
            return new JoinResult(false, null, null, 0);
        }

        final var sessions = rooms.computeIfAbsent(diagramId, (k) -> ConcurrentHashMap.newKeySet());
        PresenceSnapshot snapshot;
        PresenceParticipant joinedParticipant = null;
        long joinedPresenceVersion = 0;

        // size() + add() + presence 업데이트 원자성 보장
        synchronized (sessions) {
            if (sessions.size() >= webSocketProperties.getMaxSessionsPerRoom()) {
                userCount.decrementAndGet(); // 롤백
                log.warn(
                    "다이어그램 {} 방 입장 거부: 최대 인원({}) 초과",
                    diagramId,
                    webSocketProperties.getMaxSessionsPerRoom()
                );
                return new JoinResult(false, null, null, 0);
            }

            sessions.add(session);
            final var roomState = presenceRooms.computeIfAbsent(diagramId, (k) -> new PresenceRoomState());
            final var entry = roomState.entries.get(userId);
            if (entry == null) {
                final var joinSeq = roomState.joinSeqGenerator.incrementAndGet();
                final var newEntry = new PresenceEntry(userId, displayName, joinSeq);
                roomState.entries.put(userId, newEntry);
                joinedParticipant = new PresenceParticipant(newEntry.userId, newEntry.displayName, newEntry.joinSeq);
                joinedPresenceVersion = roomState.presenceVersion.incrementAndGet();
            } else {
                entry.sessionCount++;
                entry.displayName = displayName;
            }
            snapshot = buildPresenceSnapshot(roomState);
        }

        sessionLocks.computeIfAbsent(session.getId(), (k) -> new Object());
        log.info("다이어그램 {} 방 입장: {} (현재 {}명)", diagramId, session.getId(), sessions.size());
        return new JoinResult(true, snapshot, joinedParticipant, joinedPresenceVersion);
    }

    /**
     * 세션을 해당 다이어그램 방에서 퇴장시킨다.
     * 방이 비면 누적 update를 원자적으로 drain하여 반환하고 인메모리 리소스를 정리한다.
     *
     * @param diagramId 다이어그램 ID
     * @param session   WebSocket 세션
     * @param userId    사용자 ID
     * @return 퇴장 결과
     */
    public LeaveResult leave(Long diagramId, WebSocketSession session, String userId) {
        final var sessions = rooms.get(diagramId);
        if (sessions == null) {
            // 방이 이미 정리된 경우: 실제 퇴장 처리 없이 no-op
            sessionLocks.remove(session.getId());
            return new LeaveResult(false, new byte[0], null, null, 0);
        }

        String roomEpoch = null;
        String leftUserId = null;
        long leftPresenceVersion = 0;

        // remove + isEmpty + presence 정리 원자성 보장
        synchronized (sessions) {
            final var removed = sessions.remove(session);
            if (!removed) {
                // join 거부/중복 close 등으로 room에 존재하지 않는 세션이면 no-op
                return new LeaveResult(false, new byte[0], null, null, 0);
            }

            sessionLocks.remove(session.getId());
            log.info("다이어그램 {} 방 퇴장: {} (남은 {}명)", diagramId, session.getId(), sessions.size());

            // 실제로 room에서 제거된 경우에만 사용자별 연결 수를 감소시킨다.
            final var userCount = userSessionCounts.get(userId);
            if (userCount != null && userCount.decrementAndGet() <= 0) {
                userSessionCounts.remove(userId);
            }

            final var roomState = presenceRooms.get(diagramId);
            if (roomState != null) {
                final var entry = roomState.entries.get(userId);
                if (entry != null) {
                    entry.sessionCount--;
                    if (entry.sessionCount <= 0) {
                        roomState.entries.remove(userId);
                        roomEpoch = roomState.roomEpoch;
                        leftUserId = userId;
                        leftPresenceVersion = roomState.presenceVersion.incrementAndGet();
                    }
                }
            }

            if (sessions.isEmpty()) {
                // CAS: 동일 sessions 인스턴스일 때만 제거
                rooms.remove(diagramId, sessions);
                presenceRooms.remove(diagramId);

                // 원자적으로 누적 update를 drain하고 인메모리 리소스 정리
                final var drained = drainAndMergeUpdates(diagramId);
                accumulatedUpdates.remove(diagramId);
                accumulatedSizes.remove(diagramId);
                return new LeaveResult(true, drained, roomEpoch, leftUserId, leftPresenceVersion);
            }
        }
        return new LeaveResult(false, new byte[0], roomEpoch, leftUserId, leftPresenceVersion);
    }

    /**
     * 다이어그램 room의 현재 presence snapshot을 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return snapshot (방이 없으면 null)
     */
    public PresenceSnapshot getPresenceSnapshot(Long diagramId) {
        final var sessions = rooms.get(diagramId);
        if (sessions == null) {
            return null;
        }
        synchronized (sessions) {
            final var roomState = presenceRooms.get(diagramId);
            if (roomState == null) {
                return null;
            }
            return buildPresenceSnapshot(roomState);
        }
    }

    private PresenceSnapshot buildPresenceSnapshot(PresenceRoomState roomState) {
        final var participants = roomState.entries
            .values()
            .stream()
            .sorted(Comparator.comparingLong((PresenceEntry e) -> e.joinSeq))
            .map((e) -> new PresenceParticipant(e.userId, e.displayName, e.joinSeq))
            .toList();
        return new PresenceSnapshot(roomState.roomEpoch, roomState.presenceVersion.get(), participants);
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
     * CAS 루프로 윈도우 전환과 카운터 증가를 원자적으로 수행한다.
     *
     * @param session WebSocket 세션
     * @return 제한 이내이면 true, 초과 시 false
     */
    public boolean checkRateLimit(WebSocketSession session) {
        final var sessionId = session.getId();
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
                if (current.count() >= webSocketProperties.getMaxMessagesPerSecond()) {
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
     * @param session WebSocket 세션
     * @return 허용 여부
     */
    public boolean allowPresenceSnapshotRequest(WebSocketSession session) {
        final var sessionId = session.getId();
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
                if (current.count() >= MAX_SNAPSHOT_REQUESTS_PER_MINUTE) {
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
     * 다이어그램별 flush 락을 제거한다.
     * 마지막 사용자 퇴장 후 flush 완료 시점에 호출한다.
     *
     * @param diagramId 다이어그램 ID
     */
    public void removeFlushLock(Long diagramId) {
        flushLocks.remove(diagramId);
    }

    /**
     * 세션의 rate limit 상태를 정리한다.
     * 연결 종료 시 호출한다.
     *
     * @param session WebSocket 세션
     */
    public void cleanupRateLimit(WebSocketSession session) {
        rateLimitState.remove(session.getId());
        snapshotRequestState.remove(session.getId());
    }

    /**
     * Yjs update를 누적 리스트에 추가한다.
     * 타입 바이트(0x03)를 제외한 순수 Yjs update 바이트를 전달해야 한다.
     *
     * @param diagramId 다이어그램 ID
     * @param update    순수 Yjs update 바이트 배열 (타입 바이트 제외)
     * @return 추가 성공 여부 (false면 누적 크기 초과)
     */
    public boolean appendUpdate(Long diagramId, byte[] update) {
        // 누적 크기 체크
        final var sizeCounter = accumulatedSizes.computeIfAbsent(diagramId, (k) -> new AtomicLong(0));
        final var newSize = sizeCounter.addAndGet(update.length);
        if (newSize > webSocketProperties.getMaxAccumulatedUpdatesSize()) {
            sizeCounter.addAndGet(-update.length);
            return false;
        }

        accumulatedUpdates
            .computeIfAbsent(diagramId, (k) -> Collections.synchronizedList(new ArrayList<>()))
            .add(update);
        synchronized (dirtyLock) {
            dirtyDiagramIds.add(diagramId);
        }
        return true;
    }

    /**
     * 단독 접속(세션 1개)일 때만 원자적으로 세션 수 확인 + 누적 update drain을 수행한다.
     * sessions 락 안에서 수행하여 {@link #join}과의 TOCTOU 레이스를 방지한다.
     *
     * <p>컴팩션 시나리오에서 사용: {@code getSessionCount() == 1} 체크와
     * {@code drainAndMergeUpdates()}를 별도로 호출하면, 그 사이에
     * 새 세션이 {@code join()} + {@code appendUpdate()}를 수행하여
     * drain된 update가 컴팩션 후 유실될 수 있다.</p>
     *
     * @param diagramId 다이어그램 ID
     * @return drain된 병합 바이트 배열. 단독 접속이 아니거나 방이 없으면 {@code null}
     */
    public byte[] drainIfAlone(Long diagramId) {
        final var sessions = rooms.get(diagramId);
        if (sessions == null) {
            return null;
        }
        synchronized (sessions) {
            if (sessions.size() != 1) {
                return null;
            }
            return drainAndMergeUpdates(diagramId);
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
            // 크기 카운터 리셋: drain~set(0) 사이에 appendUpdate가 끼어드는 것을 방지
            final var sizeCounter = accumulatedSizes.get(diagramId);
            if (sizeCounter != null) {
                sizeCounter.set(0);
            }
        }

        if (drained.isEmpty()) {
            return new byte[0];
        }
        return YjsUpdateFormat.encode(drained);
    }

    /**
     * drain된 update를 인메모리 버퍼에 복원한다.
     * flush 또는 컴팩션 실패 시 데이터 유실을 방지하기 위해 호출한다.
     *
     * @param diagramId     다이어그램 ID
     * @param mergedUpdates drain된 병합 바이트 배열 (null 또는 빈 배열이면 무시)
     */
    public void restoreUpdates(Long diagramId, byte[] mergedUpdates) {
        if (mergedUpdates == null || mergedUpdates.length == 0) {
            return;
        }
        final var updates = YjsUpdateFormat.decode(mergedUpdates);
        for (final var update : updates) {
            appendUpdate(diagramId, update);
        }
        log.info("drain된 update {}개 복원 완료 (diagramId={})", updates.size(), diagramId);
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
     * 누적 update가 존재하는 모든 다이어그램 ID를 반환한다.
     * 서버 종료 시 남은 update를 일괄 flush하기 위해 사용한다.
     *
     * @return 누적 update가 있는 다이어그램 ID 집합
     */
    public Set<Long> getAllDiagramIdsWithUpdates() {
        final var ids = ConcurrentHashMap.<Long>newKeySet();
        accumulatedUpdates.forEach((diagramId, updates) -> {
            if (updates != null && !updates.isEmpty()) {
                ids.add(diagramId);
            }
        });
        return ids;
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

    /**
     * 해당 다이어그램 방의 모든 세션을 강제로 닫고 인메모리 리소스를 정리한다.
     * 팀/프로젝트 삭제 시 관련 다이어그램의 WebSocket 연결을 정리하기 위해 사용한다.
     *
     * <p>인메모리 리소스를 선제 제거하여, 세션 종료 후 {@code afterConnectionClosed}에서
     * 불필요한 flush가 발생하지 않도록 한다.</p>
     *
     * @param diagramId 다이어그램 ID
     */
    @SuppressWarnings("null")
    public void discardRoom(Long diagramId) {
        final var sessions = rooms.remove(diagramId);
        presenceRooms.remove(diagramId);
        accumulatedUpdates.remove(diagramId);
        accumulatedSizes.remove(diagramId);
        flushLocks.remove(diagramId);
        synchronized (dirtyLock) {
            dirtyDiagramIds.remove(diagramId);
        }

        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        for (final var session : sessions) {
            sessionLocks.remove(session.getId());
            rateLimitState.remove(session.getId());
            snapshotRequestState.remove(session.getId());

            // 사용자별 연결 수 감소
            final var info = extractSessionInfo(session);
            if (info != null) {
                final var userCount = userSessionCounts.get(info.userId());
                if (userCount != null && userCount.decrementAndGet() <= 0) {
                    userSessionCounts.remove(info.userId());
                }
            }

            try {
                if (session.isOpen()) {
                    session.close(CloseStatus.GOING_AWAY);
                }
            } catch (Exception e) {
                log.warn("방 폐기 시 세션 종료 실패 (세션 {})", session.getId(), e);
            }
        }
        log.info("다이어그램 {} 방 폐기 완료 ({}개 세션)", diagramId, sessions.size());
    }

    /**
     * 세션에서 WebSocketSessionInfo를 추출한다.
     * 세션 속성에 정보가 없으면 null을 반환한다.
     *
     * @param session WebSocket 세션
     * @return 세션 정보 (없으면 null)
     */
    private WebSocketSessionInfo extractSessionInfo(WebSocketSession session) {
        return (WebSocketSessionInfo) session.getAttributes().get(WebSocketSessionInfo.SESSION_ATTR_KEY);
    }
}
