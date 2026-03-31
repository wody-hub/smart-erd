package com.smarterd.application.diagram.port;

import com.smarterd.application.diagram.model.DiagramPresenceParticipantPayload;
import com.smarterd.application.diagram.model.DiagramPresenceSnapshotPayload;
import org.springframework.lang.NonNull;

/**
 * 다이어그램 presence 알림 전송 포트.
 */
public interface DiagramPresencePort {
    void sendPresenceSnapshotToSession(
        DiagramSessionRef sessionRef,
        Long diagramId,
        DiagramPresenceSnapshotPayload snapshotOverride
    );

    void broadcastPeerJoined(
        @NonNull Long diagramId,
        @NonNull DiagramSessionRef senderSessionRef,
        String roomEpoch,
        long presenceVersion,
        DiagramPresenceParticipantPayload participant
    );

    void broadcastPeerLeft(
        @NonNull Long diagramId,
        @NonNull DiagramSessionRef senderSessionRef,
        String roomEpoch,
        long presenceVersion,
        String userId
    );
}
