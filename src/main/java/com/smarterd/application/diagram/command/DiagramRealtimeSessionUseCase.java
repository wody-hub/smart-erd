package com.smarterd.application.diagram.command;

import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 실시간 세션에서 발생하는 경량 room/presence 명령을 조정한다.
 */
@Component
@RequiredArgsConstructor
public class DiagramRealtimeSessionUseCase {

    private final DiagramRoomManager roomManager;
    private final DiagramPresenceNotifier presenceNotifier;

    /**
     * 순수 Yjs update를 room 누적 버퍼에 추가한다.
     *
     * @param diagramId 다이어그램 ID
     * @param update 타입 바이트를 제외한 순수 update
     * @return 누적 성공 여부
     */
    public boolean appendRealtimeUpdate(Long diagramId, byte[] update) {
        return roomManager.appendUpdate(diagramId, update);
    }

    /**
     * rate limit을 검사한 뒤 최신 presence snapshot을 전송한다.
     *
     * @param session 대상 세션
     * @param diagramId 다이어그램 ID
     * @return rate limit 통과 여부
     */
    public boolean requestPresenceSnapshot(WebSocketSession session, Long diagramId) {
        if (!roomManager.allowPresenceSnapshotRequest(session)) {
            return false;
        }
        presenceNotifier.sendPresenceSnapshotToSession(session, diagramId, null);
        return true;
    }
}
