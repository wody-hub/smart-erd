package com.smarterd.application.diagram.command;

import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import com.smarterd.domain.diagram.websocket.relay.DiagramPresenceNotifier;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

/**
 * room leave 직후 필요한 presence 정리와 room-empty flush를 수행한다.
 */
@Component
@RequiredArgsConstructor
public class CompleteDiagramSessionLeaveUseCase {

    private final DiagramPresenceNotifier presenceNotifier;
    private final FlushDiagramDrainedUpdatesUseCase flushDiagramDrainedUpdatesUseCase;

    /**
     * leave 결과를 바탕으로 peer-left 알림과 room-empty flush를 수행한다.
     *
     * @param session WebSocket 세션
     * @param info 정규화된 세션 메타데이터. legacy peer-left 용으로만 사용한다.
     * @param diagramId 다이어그램 ID
     * @param leaveResult room leave 결과
     */
    public void complete(
        WebSocketSession session,
        @Nullable DiagramWebSocketSessionInfo info,
        Long diagramId,
        LeaveResult leaveResult
    ) {
        if (leaveResult.leftUserId() != null && leaveResult.roomEpoch() != null) {
            presenceNotifier.broadcastPeerLeft(
                diagramId,
                session,
                leaveResult.roomEpoch(),
                leaveResult.leftPresenceVersion(),
                leaveResult.leftUserId()
            );
            if (info != null) {
                presenceNotifier.broadcastPeerLeftLegacy(diagramId, session, info.loginId());
            }
        }

        if (!leaveResult.roomEmpty()) {
            return;
        }
        flushDiagramDrainedUpdatesUseCase.flush(diagramId, leaveResult.drainedUpdates());
    }
}
