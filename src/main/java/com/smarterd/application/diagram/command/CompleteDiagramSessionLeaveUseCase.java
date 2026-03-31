package com.smarterd.application.diagram.command;

import com.smarterd.application.diagram.model.DiagramSessionLeaveCompletion;
import com.smarterd.application.diagram.port.DiagramPresencePort;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * room leave 직후 필요한 presence 정리와 room-empty flush를 수행한다.
 */
@Component
@RequiredArgsConstructor
public class CompleteDiagramSessionLeaveUseCase {

    private final DiagramPresencePort diagramPresencePort;
    private final FlushDiagramDrainedUpdatesUseCase flushDiagramDrainedUpdatesUseCase;

    /**
     * leave 결과를 바탕으로 peer-left 알림과 room-empty flush를 수행한다.
     *
     * @param sessionRef WebSocket 세션 식별자
     * @param diagramId 다이어그램 ID
     * @param leaveCompletion room leave 후속 처리 payload
     */
    public void complete(DiagramSessionRef sessionRef, Long diagramId, DiagramSessionLeaveCompletion leaveCompletion) {
        if (leaveCompletion.leftUserId() != null && leaveCompletion.roomEpoch() != null) {
            diagramPresencePort.broadcastPeerLeft(
                diagramId,
                sessionRef,
                leaveCompletion.roomEpoch(),
                leaveCompletion.leftPresenceVersion(),
                leaveCompletion.leftUserId()
            );
        }

        if (!leaveCompletion.roomEmpty()) {
            return;
        }
        flushDiagramDrainedUpdatesUseCase.flush(diagramId, leaveCompletion.drainedUpdates());
    }
}
