package com.smarterd.application.diagram.command;

import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

/**
 * room join 직후 필요한 presence 초기 전송을 수행한다.
 */
@Component
@RequiredArgsConstructor
public class CompleteDiagramSessionJoinUseCase {

    private final DiagramPresenceNotifier presenceNotifier;

    /**
     * join 결과를 바탕으로 snapshot과 peer-joined 알림을 전송한다.
     *
     * @param session WebSocket 세션
     * @param info 정규화된 세션 메타데이터
     * @param joinResult room join 결과
     */
    public void complete(WebSocketSession session, DiagramWebSocketSessionInfo info, JoinResult joinResult) {
        presenceNotifier.sendPresenceSnapshotToSession(session, info.diagramId(), joinResult.snapshot());

        if (joinResult.joinedParticipant() == null || joinResult.snapshot() == null) {
            return;
        }

        presenceNotifier.broadcastPeerJoined(
            info.diagramId(),
            session,
            joinResult.snapshot().roomEpoch(),
            joinResult.joinedPresenceVersion(),
            joinResult.joinedParticipant()
        );
    }
}
