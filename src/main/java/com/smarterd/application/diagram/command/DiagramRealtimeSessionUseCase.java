package com.smarterd.application.diagram.command;

import com.smarterd.application.diagram.port.DiagramPresencePort;
import com.smarterd.application.diagram.port.DiagramRealtimeSessionPort;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 실시간 세션에서 발생하는 경량 room/presence 명령을 조정한다.
 */
@Component
@RequiredArgsConstructor
public class DiagramRealtimeSessionUseCase {

    private final DiagramRealtimeSessionPort diagramRealtimeSessionPort;
    private final DiagramPresencePort diagramPresencePort;

    /**
     * 순수 Yjs update를 room 누적 버퍼에 추가한다.
     *
     * @param diagramId 다이어그램 ID
     * @param update 타입 바이트를 제외한 순수 update
     * @return 누적 성공 여부
     */
    public boolean appendRealtimeUpdate(Long diagramId, byte[] update) {
        return diagramRealtimeSessionPort.appendRealtimeUpdate(diagramId, update);
    }

    /**
     * rate limit을 검사한 뒤 최신 presence snapshot을 전송한다.
     *
     * @param sessionRef 대상 세션 식별자
     * @param diagramId 다이어그램 ID
     * @return rate limit 통과 여부
     */
    public boolean requestPresenceSnapshot(DiagramSessionRef sessionRef, Long diagramId) {
        if (!diagramRealtimeSessionPort.allowPresenceSnapshotRequest(sessionRef)) {
            return false;
        }
        diagramPresencePort.sendPresenceSnapshotToSession(sessionRef, diagramId, null);
        return true;
    }
}
