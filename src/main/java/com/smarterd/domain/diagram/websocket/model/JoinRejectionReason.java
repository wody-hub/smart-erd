package com.smarterd.domain.diagram.websocket.model;

/**
 * WebSocket room join 거부 사유.
 */
public enum JoinRejectionReason {
    CONNECTION_LIMIT_EXCEEDED("connection-limit-exceeded"),
    ROOM_CAPACITY_EXCEEDED("room-capacity-exceeded");

    private final String closeReason;

    JoinRejectionReason(String closeReason) {
        this.closeReason = closeReason;
    }

    public String closeReason() {
        return closeReason;
    }
}
