package com.smarterd.application.diagram.port;

/**
 * 다이어그램 실시간 room 런타임 포트.
 */
public interface DiagramRealtimeSessionPort {

    boolean appendRealtimeUpdate(Long diagramId, byte[] update);

    boolean allowPresenceSnapshotRequest(DiagramSessionRef sessionRef);
}
