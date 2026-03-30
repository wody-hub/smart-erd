package com.smarterd.domain.diagram.websocket.room;

import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.websocket.model.JoinRejectionReason;
import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import com.smarterd.domain.diagram.websocket.model.PresenceSnapshot;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Objects;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
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
@Slf4j
public class DiagramRoomManager {

    /** Presence snapshot 재요청 허용 횟수 (세션당 분당) */
    private static final int MAX_SNAPSHOT_REQUESTS_PER_MINUTE = 6;

    /** WebSocket 설정 프로퍼티 */
    private final WebSocketProperties webSocketProperties;

    /** 세션/room/락/사용자 연결 수 저장소 */
    private final DiagramSessionRegistry sessionRegistry;

    /** presence 상태 저장소 */
    private final DiagramPresenceManager presenceManager;

    /** update 누적 버퍼 저장소 */
    private final DiagramUpdateBuffer updateBuffer;

    /** 세션 rate limiter 저장소 */
    private final DiagramSessionRateLimiter rateLimiter;

    /**
     * 기본 생성자.
     *
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

    /**
     * 테스트/확장 포인트를 위한 내부 생성자.
     */
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
        this.updateBuffer = updateBuffer;
        this.rateLimiter = rateLimiter;
    }

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
            return new JoinResult(false, JoinRejectionReason.CONNECTION_LIMIT_EXCEEDED, null, null, 0);
        }

        final var sessions = sessionRegistry.getOrCreateSessions(diagramId);
        DiagramPresenceManager.PresenceJoinResult presenceJoinResult;

        // size() + add() + presence 업데이트 원자성 보장
        synchronized (sessions) {
            if (sessions.size() >= webSocketProperties.getMaxSessionsPerRoom()) {
                sessionRegistry.releaseUserConnection(userId); // 롤백
                log.warn(
                    "다이어그램 {} 방 입장 거부: 현재 {}명, 최대 {}명",
                    diagramId,
                    sessions.size(),
                    webSocketProperties.getMaxSessionsPerRoom()
                );
                return new JoinResult(false, JoinRejectionReason.ROOM_CAPACITY_EXCEEDED, null, null, 0);
            }

            sessions.add(session);
            presenceJoinResult = presenceManager.onJoin(sessions, diagramId, userId, displayName);
        }

        sessionRegistry.bindSession(session);
        sessionRegistry.ensureSessionLock(session.getId());
        sessionRegistry.bindSessionUser(session.getId(), userId);
        sessionRegistry.bindSessionDiagram(session.getId(), diagramId);
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
     * 세션을 해당 다이어그램 방에서 퇴장시킨다.
     * 방이 비면 누적 update를 원자적으로 drain하여 반환하고 인메모리 리소스를 정리한다.
     *
     * @param diagramId 다이어그램 ID
     * @param session   WebSocket 세션
     * @param userId    사용자 ID
     * @return 퇴장 결과
     */
    public LeaveResult leave(Long diagramId, WebSocketSession session, String userId) {
        final var mappedDiagramId = sessionRegistry.findDiagramIdBySessionId(session.getId());
        final var sessions = sessionRegistry.getSessions(diagramId);
        if (sessions == null) {
            // 다른 room에 속한 세션에 대해 잘못 호출된 leave는 상태를 건드리지 않는다.
            if (mappedDiagramId != null && !mappedDiagramId.equals(diagramId)) {
                return new LeaveResult(false, new byte[0], null, null, 0);
            }

            // 방이 이미 정리된 경우: 실제 퇴장 처리 없이 no-op
            final var mappedUserId = sessionRegistry.unbindSessionUser(session.getId());
            sessionRegistry.unbindSessionDiagram(session.getId());
            sessionRegistry.removeSessionLock(session.getId());
            sessionRegistry.removeSession(session.getId());
            if (mappedUserId != null) {
                sessionRegistry.releaseUserConnection(mappedUserId);
            }
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

            sessionRegistry.removeSessionLock(session.getId());
            sessionRegistry.removeSession(session.getId());
            sessionRegistry.unbindSessionDiagram(session.getId());
            log.info("다이어그램 {} 방 퇴장: {} (남은 {}명)", diagramId, session.getId(), sessions.size());

            final var mappedUserIdBeforeUnbind = sessionRegistry.getSessionUser(session.getId());
            final var effectiveUserId = mappedUserIdBeforeUnbind != null ? mappedUserIdBeforeUnbind : userId;

            // 실제로 room에서 제거된 경우에만 사용자별 연결 수를 감소시킨다.
            final var unboundUserId = sessionRegistry.unbindSessionUser(session.getId());
            final var userIdToRelease = unboundUserId != null ? unboundUserId : effectiveUserId;
            if (userIdToRelease != null) {
                sessionRegistry.releaseUserConnection(userIdToRelease);
            }

            if (effectiveUserId != null) {
                final var presenceLeaveResult = presenceManager.onLeave(sessions, diagramId, effectiveUserId);
                roomEpoch = presenceLeaveResult.roomEpoch();
                leftUserId = presenceLeaveResult.leftUserId();
                leftPresenceVersion = presenceLeaveResult.leftPresenceVersion();
            }

            if (sessions.isEmpty()) {
                // CAS: 동일 sessions 인스턴스일 때만 제거
                sessionRegistry.removeRoomIfSame(diagramId, sessions);
                presenceManager.removeRoom(diagramId);

                // 원자적으로 누적 update를 drain하고 인메모리 리소스 정리
                final var drained = updateBuffer.drainAndMergeUpdates(diagramId);
                updateBuffer.removeDiagram(diagramId);
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
        final var sessions = sessionRegistry.getSessions(diagramId);
        if (sessions == null) {
            return null;
        }
        synchronized (sessions) {
            return presenceManager.getPresenceSnapshot(sessions, diagramId);
        }
    }

    public void broadcast(@NonNull Long diagramId, @NonNull String senderSessionId, @NonNull BinaryMessage message) {
        final var nonNullDiagramId = Objects.requireNonNull(diagramId, "diagramId must not be null");
        final var nonNullSenderSessionId = Objects.requireNonNull(senderSessionId, "senderSessionId must not be null");
        final var nonNullMessage = Objects.requireNonNull(message, "message must not be null");
        final var payload = copyPayload(nonNullMessage);
        final var isLast = nonNullMessage.isLast();

        final var sessions = sessionRegistry.getSessionsOrEmpty(nonNullDiagramId);
        for (final var session : sessions) {
            if (nonNullSenderSessionId.equals(session.getId()) || !session.isOpen()) {
                continue;
            }
            try {
                final var lock = getSessionLock(session);
                synchronized (lock) {
                    session.sendMessage(new BinaryMessage(Arrays.copyOf(payload, payload.length), isLast));
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
        return rateLimiter.checkRateLimit(session.getId(), webSocketProperties.getMaxMessagesPerSecond());
    }

    public boolean allowPresenceSnapshotRequest(String sessionId) {
        return rateLimiter.allowPresenceSnapshotRequest(sessionId);
    }

    /**
     * 세션별 전송 동기화 락 객체를 반환한다.
     * 세션에 대한 동시 sendMessage 호출을 직렬화하기 위해 사용한다.
     *
     * @param session WebSocket 세션
     * @return 해당 세션의 전용 락 객체
     */
    public Object getSessionLock(WebSocketSession session) {
        return sessionRegistry.getSessionLock(session);
    }

    /**
     * 다이어그램별 flush 동기화 락 객체를 반환한다.
     * {@code @Scheduled} flush와 연결 종료 시 flush가 동시에 실행되는 것을 방지한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 해당 다이어그램의 전용 flush 락 객체
     */
    public Object getFlushLock(Long diagramId) {
        return sessionRegistry.getFlushLock(diagramId);
    }

    /**
     * 다이어그램별 flush 락을 제거한다.
     * 마지막 사용자 퇴장 후 flush 완료 시점에 호출한다.
     *
     * @param diagramId 다이어그램 ID
     */
    public void removeFlushLock(Long diagramId) {
        sessionRegistry.removeFlushLock(diagramId);
    }

    public void cleanupRateLimit(String sessionId) {
        rateLimiter.cleanup(sessionId);
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
        // flush/restore 경로와 append 경합을 줄이기 위해 diagram 단위 flush lock으로 직렬화한다.
        synchronized (getFlushLock(diagramId)) {
            return updateBuffer.appendUpdate(diagramId, update, webSocketProperties.getMaxAccumulatedUpdatesSize());
        }
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
        final var sessions = sessionRegistry.getSessions(diagramId);
        if (sessions == null) {
            return null;
        }
        synchronized (sessions) {
            if (sessions.size() != 1) {
                return null;
            }
            return updateBuffer.drainAndMergeUpdates(diagramId);
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
        return updateBuffer.drainAndMergeUpdates(diagramId);
    }

    /**
     * 현재 누적된 update를 비우지 않고 병합 snapshot 형태로 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 병합된 바이트 배열, 누적 데이터가 없으면 빈 배열
     */
    public byte[] peekMergedUpdates(Long diagramId) {
        synchronized (getFlushLock(diagramId)) {
            return updateBuffer.peekMergedUpdates(diagramId);
        }
    }

    /**
     * drain된 update를 인메모리 버퍼에 복원한다.
     * flush 또는 컴팩션 실패 시 데이터 유실을 방지하기 위해 호출한다.
     *
     * @param diagramId     다이어그램 ID
     * @param mergedUpdates drain된 병합 바이트 배열 (null 또는 빈 배열이면 무시)
     * @return 복원 성공 여부
     */
    public boolean restoreUpdates(Long diagramId, byte[] mergedUpdates) {
        synchronized (getFlushLock(diagramId)) {
            return updateBuffer.restoreUpdates(
                diagramId,
                mergedUpdates,
                webSocketProperties.getMaxAccumulatedUpdatesSize()
            );
        }
    }

    /**
     * 다이어그램의 누적 update 버퍼를 최신 단일 update 기준으로 교체한다.
     *
     * 클라이언트가 전체 Y.Doc 상태를 서버 persisted snapshot으로 밀어넣은 직후,
     * room warm handoff/연결 종료 flush도 같은 기준을 보도록 맞춘다.
     *
     * @param diagramId 다이어그램 ID
     * @param update 최신 전체 상태를 나타내는 raw Yjs update
     */
    public void replaceUpdates(Long diagramId, byte[] update) {
        synchronized (getFlushLock(diagramId)) {
            updateBuffer.replaceWithSingleUpdate(diagramId, update);
        }
    }

    public String findUserIdBySessionId(String sessionId) {
        return sessionRegistry.getSessionUser(sessionId);
    }

    public Long findDiagramIdBySessionId(String sessionId) {
        return sessionRegistry.findDiagramIdBySessionId(sessionId);
    }

    /**
     * 세션 ID에 매핑된 실제 WebSocket 세션을 조회한다.
     *
     * @param sessionId WebSocket 세션 ID
     * @return 세션 객체. 없으면 {@code null}
     */
    public WebSocketSession getSession(String sessionId) {
        return sessionRegistry.getSession(sessionId);
    }

    /**
     * 해당 다이어그램에 누적된 update가 있는지 확인한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 누적 update 존재 여부
     */
    public boolean hasUpdates(Long diagramId) {
        return updateBuffer.hasUpdates(diagramId);
    }

    /**
     * 다이어그램을 다시 dirty 상태로 표시한다.
     * flush 실패 시 재시도를 위해 사용한다.
     *
     * @param diagramId 다이어그램 ID
     */
    public void reDirty(Long diagramId) {
        updateBuffer.reDirty(diagramId);
    }

    /**
     * 변경되었지만 아직 DB에 저장되지 않은 다이어그램 ID를 원자적으로 반환하고 dirty 상태를 초기화한다.
     *
     * @return dirty 다이어그램 ID 집합
     */
    public Set<Long> getDirtyIdsAndClear() {
        return updateBuffer.getDirtyIdsAndClear();
    }

    /**
     * 누적 update가 존재하는 모든 다이어그램 ID를 반환한다.
     * 서버 종료 시 남은 update를 일괄 flush하기 위해 사용한다.
     *
     * @return 누적 update가 있는 다이어그램 ID 집합
     */
    public Set<Long> getAllDiagramIdsWithUpdates() {
        return updateBuffer.getAllDiagramIdsWithUpdates();
    }

    /**
     * 해당 다이어그램 방의 현재 접속자 수를 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 접속자 수
     */
    public int getSessionCount(Long diagramId) {
        return sessionRegistry.getSessionCount(diagramId);
    }

    /**
     * 해당 다이어그램 방의 모든 세션을 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 세션 집합 (없으면 빈 집합)
     */
    public Set<WebSocketSession> getSessions(Long diagramId) {
        return sessionRegistry.getSessionsOrEmpty(diagramId);
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
    public void discardRoom(@NonNull Long diagramId) {
        final var nonNullDiagramId = Objects.requireNonNull(diagramId, "diagramId must not be null");

        final var sessions = sessionRegistry.removeRoom(nonNullDiagramId);
        presenceManager.removeRoom(nonNullDiagramId);
        updateBuffer.removeDiagram(nonNullDiagramId);
        sessionRegistry.removeFlushLock(nonNullDiagramId);

        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        for (final var session : sessions) {
            sessionRegistry.removeSessionLock(session.getId());
            sessionRegistry.removeSession(session.getId());
            rateLimiter.cleanup(session.getId());

            // 사용자별 연결 수 감소
            final var mappedUserId = sessionRegistry.unbindSessionUser(session.getId());
            sessionRegistry.unbindSessionDiagram(session.getId());
            if (mappedUserId != null) {
                sessionRegistry.releaseUserConnection(mappedUserId);
            }

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
     * BinaryMessage payload를 세션별 재전송에 안전한 byte 배열로 복사한다.
     *
     * @param message 원본 바이너리 메시지
     * @return 복사된 payload
     */
    private byte[] copyPayload(BinaryMessage message) {
        final ByteBuffer buffer = message.getPayload().asReadOnlyBuffer();
        final var payload = new byte[buffer.remaining()];
        buffer.get(payload);
        return payload;
    }
}
