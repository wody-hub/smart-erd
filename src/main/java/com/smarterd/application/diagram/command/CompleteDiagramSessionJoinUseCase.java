package com.smarterd.application.diagram.command;

import com.smarterd.application.diagram.model.DiagramSessionJoinCompletion;
import com.smarterd.application.diagram.port.DiagramPresencePort;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * room join 직후 필요한 presence 초기 전송을 수행한다.
 */
@Component
@RequiredArgsConstructor
public class CompleteDiagramSessionJoinUseCase {

    private final DiagramPresencePort diagramPresencePort;

    /**
     * join 결과를 바탕으로 snapshot과 peer-joined 알림을 전송한다.
     *
     * @param sessionRef WebSocket 세션 식별자
     * @param diagramId 다이어그램 ID
     * @param joinCompletion room join 후속 처리 payload
     */
    public void complete(DiagramSessionRef sessionRef, Long diagramId, DiagramSessionJoinCompletion joinCompletion) {
        diagramPresencePort.sendPresenceSnapshotToSession(sessionRef, diagramId, joinCompletion.snapshot());

        if (joinCompletion.joinedParticipant() == null || joinCompletion.snapshot() == null) {
            return;
        }

        diagramPresencePort.broadcastPeerJoined(
            diagramId,
            sessionRef,
            joinCompletion.snapshot().roomEpoch(),
            joinCompletion.joinedPresenceVersion(),
            joinCompletion.joinedParticipant()
        );
    }
}
