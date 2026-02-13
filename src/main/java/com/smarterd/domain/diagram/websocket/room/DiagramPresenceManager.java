package com.smarterd.domain.diagram.websocket.room;

import com.smarterd.domain.diagram.websocket.model.PresenceParticipant;
import com.smarterd.domain.diagram.websocket.model.PresenceSnapshot;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 다이어그램 room의 presence 상태를 관리하는 내부 저장소.
 *
 * <p>호출자는 room 세션 락(synchronized(sessions))을 보유한 상태에서 호출해야 하며,
 * 본 클래스는 런타임에 해당 계약을 검증한다.</p>
 */
final class DiagramPresenceManager {

    /** 다이어그램 ID → room 단위 presence 상태 */
    private final Map<Long, PresenceRoomState> presenceRooms = new ConcurrentHashMap<>();

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

    /**
     * 입장 처리 결과.
     *
     * @param snapshot              입장 직후 snapshot
     * @param joinedParticipant     완전 신규 입장 사용자 정보 (기존 사용자면 null)
     * @param joinedPresenceVersion 신규 입장 이벤트 version
     */
    record PresenceJoinResult(
        PresenceSnapshot snapshot,
        PresenceParticipant joinedParticipant,
        long joinedPresenceVersion
    ) {}

    /**
     * 퇴장 처리 결과.
     *
     * @param roomEpoch           room epoch
     * @param leftUserId          완전 퇴장 사용자 ID
     * @param leftPresenceVersion 완전 퇴장 이벤트 version
     */
    record PresenceLeaveResult(String roomEpoch, String leftUserId, long leftPresenceVersion) {}

    /**
     * room 입장 시 presence를 갱신한다.
     *
     * @param roomLock    room 동기화에 사용한 락 객체(sessions)
     * @param diagramId   다이어그램 ID
     * @param userId      사용자 ID
     * @param displayName 사용자 표시 이름
     * @return 입장 결과
     */
    PresenceJoinResult onJoin(Object roomLock, Long diagramId, String userId, String displayName) {
        requireRoomLock(roomLock);
        final var roomState = presenceRooms.computeIfAbsent(diagramId, (k) -> new PresenceRoomState());
        PresenceParticipant joinedParticipant = null;
        long joinedPresenceVersion = 0;

        final var entry = roomState.entries.get(userId);
        if (entry == null) {
            final var joinSeq = roomState.joinSeqGenerator.incrementAndGet();
            final var newEntry = new PresenceEntry(userId, displayName, joinSeq);
            roomState.entries.put(userId, newEntry);
            joinedParticipant = new PresenceParticipant(
                newEntry.userId,
                newEntry.displayName,
                newEntry.joinSeq
            );
            joinedPresenceVersion = roomState.presenceVersion.incrementAndGet();
        } else {
            entry.sessionCount++;
            entry.displayName = displayName;
        }
        return new PresenceJoinResult(buildPresenceSnapshot(roomState), joinedParticipant, joinedPresenceVersion);
    }

    /**
     * room 퇴장 시 presence를 갱신한다.
     *
     * @param roomLock room 동기화에 사용한 락 객체(sessions)
     * @param diagramId 다이어그램 ID
     * @param userId    사용자 ID
     * @return 퇴장 결과
     */
    PresenceLeaveResult onLeave(Object roomLock, Long diagramId, String userId) {
        requireRoomLock(roomLock);
        final var roomState = presenceRooms.get(diagramId);
        if (roomState == null) {
            return new PresenceLeaveResult(null, null, 0);
        }

        String roomEpoch = null;
        String leftUserId = null;
        long leftPresenceVersion = 0;

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
        return new PresenceLeaveResult(roomEpoch, leftUserId, leftPresenceVersion);
    }

    /**
     * room의 현재 presence snapshot을 반환한다.
     *
     * @param roomLock room 동기화에 사용한 락 객체(sessions)
     * @param diagramId 다이어그램 ID
     * @return snapshot. room이 없으면 {@code null}
     */
    PresenceSnapshot getPresenceSnapshot(Object roomLock, Long diagramId) {
        requireRoomLock(roomLock);
        final var roomState = presenceRooms.get(diagramId);
        if (roomState == null) {
            return null;
        }
        return buildPresenceSnapshot(roomState);
    }

    /**
     * room presence 상태를 제거한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void removeRoom(Long diagramId) {
        presenceRooms.remove(diagramId);
    }

    private void requireRoomLock(Object roomLock) {
        if (!Thread.holdsLock(roomLock)) {
            throw new IllegalStateException("presence 접근은 room lock 보유 상태에서만 호출해야 합니다.");
        }
    }

    private PresenceSnapshot buildPresenceSnapshot(PresenceRoomState roomState) {
        final var participants = roomState.entries
            .values()
            .stream()
            .sorted(Comparator.comparingLong((PresenceEntry e) -> e.joinSeq))
            .map((e) -> new PresenceParticipant(e.userId, e.displayName, e.joinSeq))
            .toList();
        return new PresenceSnapshot(
            roomState.roomEpoch,
            roomState.presenceVersion.get(),
            participants
        );
    }
}
