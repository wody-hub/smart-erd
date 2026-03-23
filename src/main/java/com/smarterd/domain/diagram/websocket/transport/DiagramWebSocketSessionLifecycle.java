package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 WebSocket 세션의 join/leave/flush 수명주기를 관리한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DiagramWebSocketSessionLifecycle {

    private final DiagramRoomManager roomManager;
    private final DiagramSnapshotService snapshotService;
    private final DiagramPresenceNotifier presenceNotifier;

    /**
     * 세션을 방에 입장시키고 presence 초기 메시지를 전송한다.
     *
     * @param session WebSocket 세션
     * @param info 정규화된 세션 메타데이터
     */
    public void establish(WebSocketSession session, DiagramWebSocketSessionInfo info) {
        final var joinResult = roomManager.join(info.diagramId(), session, info.userId(), info.userName());
        if (!joinResult.accepted()) {
            try {
                session.close(Objects.requireNonNull(CloseStatus.POLICY_VIOLATION));
            } catch (Exception e) {
                log.warn("방 입장 거부 후 세션 종료 실패", e);
            }
            return;
        }

        presenceNotifier.sendPresenceSnapshotToSession(session, info.diagramId(), joinResult.snapshot());

        if (joinResult.joinedParticipant() != null && joinResult.snapshot() != null) {
            presenceNotifier.broadcastPeerJoined(
                Objects.requireNonNull(info.diagramId()),
                session,
                joinResult.snapshot().roomEpoch(),
                joinResult.joinedPresenceVersion(),
                joinResult.joinedParticipant()
            );
        }
    }

    /**
     * 세션 종료 시 room leave, presence 정리, drain flush를 수행한다.
     *
     * @param session WebSocket 세션
     * @param info 세션 메타데이터. 없으면 roomManager 조회 결과로 보완한다.
     */
    public void close(WebSocketSession session, @Nullable DiagramWebSocketSessionInfo info) {
        roomManager.cleanupRateLimit(session);
        final var diagramId = info != null ? info.diagramId() : roomManager.findDiagramIdBySession(session);
        final var userId = info != null ? info.userId() : roomManager.findUserIdBySession(session);
        if (diagramId == null) {
            log.warn("WebSocket 세션 메타데이터/room 조회 실패로 종료 정리 생략 (세션 {})", session.getId());
            return;
        }

        final var result = roomManager.leave(diagramId, session, userId);

        if (result.leftUserId() != null && result.roomEpoch() != null) {
            presenceNotifier.broadcastPeerLeft(
                Objects.requireNonNull(diagramId),
                session,
                result.roomEpoch(),
                result.leftPresenceVersion(),
                result.leftUserId()
            );
            if (info != null) {
                presenceNotifier.broadcastPeerLeftLegacy(Objects.requireNonNull(diagramId), session, info.loginId());
            }
        }

        if (!result.roomEmpty()) {
            return;
        }

        snapshotService.clearCompactionCoolDown(diagramId);
        try {
            if (result.drainedUpdates().length > 0) {
                synchronized (roomManager.getFlushLock(diagramId)) {
                    try {
                        snapshotService.saveSnapshotWithUpdates(diagramId, result.drainedUpdates());
                    } catch (Exception e) {
                        final var restored = roomManager.restoreUpdates(diagramId, result.drainedUpdates());
                        if (!restored) {
                            log.error("연결 종료 flush 실패 후 update 복원 실패 (diagramId={})", diagramId);
                        }
                        log.error("연결 종료 flush 실패, drain된 update 복원 (diagramId={})", diagramId, e);
                    }
                }
            }
        } finally {
            roomManager.removeFlushLock(diagramId);
        }
    }
}
