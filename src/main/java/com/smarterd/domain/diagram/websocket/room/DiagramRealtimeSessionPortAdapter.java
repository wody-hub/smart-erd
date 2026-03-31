package com.smarterd.domain.diagram.websocket.room;

import com.smarterd.application.diagram.port.DiagramRealtimeSessionPort;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Diagram room runtime을 application port로 노출하는 adapter.
 */
@Component
@RequiredArgsConstructor
public class DiagramRealtimeSessionPortAdapter implements DiagramRealtimeSessionPort {

    private final DiagramRoomManager roomManager;

    @Override
    public boolean appendRealtimeUpdate(Long diagramId, byte[] update) {
        return roomManager.appendUpdate(diagramId, update);
    }

    @Override
    public boolean allowPresenceSnapshotRequest(DiagramSessionRef sessionRef) {
        return roomManager.allowPresenceSnapshotRequest(sessionRef.sessionId());
    }
}
