package com.smarterd.domain.diagram.websocket.relay;

import com.smarterd.application.diagram.model.DiagramPresenceParticipantPayload;
import com.smarterd.application.diagram.model.DiagramPresenceSnapshotPayload;
import com.smarterd.application.diagram.port.DiagramPresencePort;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import com.smarterd.domain.diagram.websocket.mapper.DiagramApplicationPayloadMapper;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.diagram.websocket.transport.DiagramLegacyPresencePort;
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
public class DiagramPresenceNotifier implements DiagramPresencePort, DiagramLegacyPresencePort {

    private final DiagramRoomManager roomManager;
    private final DiagramMessageSender messageSender;

    /**
     * Presence snapshot을 특정 세션에 전송한다.
     *
     * @param session          대상 세션
     * @param diagramId        다이어그램 ID
     * @param snapshotOverride 외부에서 전달된 snapshot. {@code null}이면 roomManager 조회 결과를 사용
     */
    @Override
    public void sendPresenceSnapshotToSession(
        DiagramSessionRef sessionRef,
        Long diagramId,
        DiagramPresenceSnapshotPayload snapshotOverride
    ) {
        try {
            final var session = roomManager.getSession(sessionRef.sessionId());
            if (session == null) {
                log.warn("Presence snapshot 대상 세션을 찾지 못함 (diagramId={}, sessionId={})", diagramId, sessionRef.sessionId());
                return;
            }
            final var snapshot = snapshotOverride != null
                ? snapshotOverride
                : DiagramApplicationPayloadMapper.toSnapshotPayload(roomManager.getPresenceSnapshot(diagramId));
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
            log.warn("Presence snapshot 전송 실패 (diagramId={}, sessionId={})", diagramId, sessionRef.sessionId(), e);
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
    @Override
    public void broadcastPeerJoined(
        @NonNull Long diagramId,
        @NonNull DiagramSessionRef senderSessionRef,
        String roomEpoch,
        long presenceVersion,
        DiagramPresenceParticipantPayload participant
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
            messageSender.broadcastJsonToRoom(
                diagramId,
                senderSessionRef.sessionId(),
                DiagramMessageTypes.MSG_PEER_JOINED,
                payloadMap
            );
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
    @Override
    public void broadcastPeerLeft(
        @NonNull Long diagramId,
        @NonNull DiagramSessionRef senderSessionRef,
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
            messageSender.broadcastJsonToRoom(
                diagramId,
                senderSessionRef.sessionId(),
                DiagramMessageTypes.MSG_PEER_LEFT,
                payloadMap
            );
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
    public void broadcastPeerLeftLegacy(@NonNull Long diagramId, @NonNull DiagramSessionRef senderSessionRef, String loginId) {
        try {
            final var payloadMap = Map.of("loginId", loginId);
            messageSender.broadcastJsonToRoom(
                diagramId,
                senderSessionRef.sessionId(),
                DiagramMessageTypes.MSG_PEER_LEFT_LEGACY,
                payloadMap
            );
        } catch (Exception e) {
            log.warn("Legacy PEER_LEFT 메시지 생성 실패 (loginId={})", loginId, e);
        }
    }

}
