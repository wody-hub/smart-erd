package com.smarterd.domain.diagram.websocket.relay;

import com.smarterd.domain.diagram.websocket.model.PresenceParticipant;
import com.smarterd.domain.diagram.websocket.model.PresenceSnapshot;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

/**
 * presence 관련 payload 생성 및 전송 유틸.
 *
 * <p>핸들러/핸들러 본체에서 공통으로 사용하는 presence 전송 로직을 한곳에서 관리한다.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DiagramPresenceNotifier {

    private final DiagramRoomManager roomManager;
    private final DiagramMessageSender messageSender;

    /**
     * Presence snapshot을 특정 세션에 전송한다.
     *
     * @param session          대상 세션
     * @param diagramId        다이어그램 ID
     * @param snapshotOverride 외부에서 전달된 snapshot. {@code null}이면 roomManager 조회 결과를 사용
     */
    public void sendPresenceSnapshotToSession(
        WebSocketSession session,
        Long diagramId,
        PresenceSnapshot snapshotOverride
    ) {
        try {
            final var snapshot =
                snapshotOverride != null ? snapshotOverride : roomManager.getPresenceSnapshot(diagramId);
            if (snapshot == null) {
                return;
            }

            final var payloadMap = Map.of(
                "diagramId",
                String.valueOf(diagramId),
                "roomEpoch",
                snapshot.roomEpoch(),
                "presenceVersion",
                snapshot.presenceVersion(),
                "participants",
                snapshot.participants(),
                "totalIncludingSelf",
                snapshot.participants().size()
            );
            messageSender.sendJsonToSession(session, DiagramMessageTypes.MSG_PRESENCE_SNAPSHOT, payloadMap);
        } catch (Exception e) {
            log.warn("Presence snapshot 전송 실패 (diagramId={}, session={})", diagramId, session.getId(), e);
        }
    }

    /**
     * Presence peer joined 메시지를 브로드캐스트한다.
     *
     * @param diagramId       다이어그램 ID
     * @param sender          발신 세션
     * @param roomEpoch       room epoch
     * @param presenceVersion presence 버전
     * @param participant     입장한 사용자 정보
     */
    public void broadcastPeerJoined(
        @NonNull Long diagramId,
        @NonNull WebSocketSession sender,
        String roomEpoch,
        long presenceVersion,
        PresenceParticipant participant
    ) {
        try {
            final var payloadMap = Map.of(
                "diagramId",
                String.valueOf(diagramId),
                "roomEpoch",
                roomEpoch,
                "presenceVersion",
                presenceVersion,
                "participant",
                participant
            );
            messageSender.broadcastJsonToRoom(diagramId, sender, DiagramMessageTypes.MSG_PEER_JOINED, payloadMap);
        } catch (Exception e) {
            log.warn("PEER_JOINED 메시지 생성 실패 (diagramId={})", diagramId, e);
        }
    }

    /**
     * Presence peer left 메시지를 브로드캐스트한다.
     *
     * @param diagramId       다이어그램 ID
     * @param sender          발신 세션
     * @param roomEpoch       room epoch
     * @param presenceVersion presence 버전
     * @param userId          퇴장한 사용자 ID
     */
    public void broadcastPeerLeft(
        @NonNull Long diagramId,
        @NonNull WebSocketSession sender,
        String roomEpoch,
        long presenceVersion,
        String userId
    ) {
        try {
            final var payloadMap = Map.of(
                "diagramId",
                String.valueOf(diagramId),
                "roomEpoch",
                roomEpoch,
                "presenceVersion",
                presenceVersion,
                "userId",
                userId
            );
            messageSender.broadcastJsonToRoom(diagramId, sender, DiagramMessageTypes.MSG_PEER_LEFT, payloadMap);
        } catch (Exception e) {
            log.warn("PEER_LEFT 메시지 생성 실패 (diagramId={}, userId={})", diagramId, userId, e);
        }
    }

    /**
     * 구버전 클라이언트 호환을 위한 loginId 기반 peer-left 브로드캐스트.
     *
     * @param diagramId 다이어그램 ID
     * @param sender    발신 세션
     * @param loginId   퇴장한 사용자 loginId
     */
    public void broadcastPeerLeftLegacy(@NonNull Long diagramId, @NonNull WebSocketSession sender, String loginId) {
        try {
            final var payloadMap = Map.of("loginId", loginId);
            messageSender.broadcastJsonToRoom(diagramId, sender, DiagramMessageTypes.MSG_PEER_LEFT_LEGACY, payloadMap);
        } catch (Exception e) {
            log.warn("Legacy PEER_LEFT 메시지 생성 실패 (loginId={})", loginId, e);
        }
    }
}
