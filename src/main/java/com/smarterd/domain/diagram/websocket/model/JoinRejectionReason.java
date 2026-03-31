package com.smarterd.domain.diagram.websocket.model;

/**
 * WebSocket room join 거부 사유.
 */
public enum JoinRejectionReason {
    CONNECTION_LIMIT_EXCEEDED(4408, "connection-limit-exceeded"),
    ROOM_CAPACITY_EXCEEDED(4409, "room-capacity-exceeded");

    private final int closeCode;
    private final String closeReason;

    JoinRejectionReason(int closeCode, String closeReason) {
        this.closeCode = closeCode;
        this.closeReason = closeReason;
    }

    public int closeCode() {
        return closeCode;
    }

    public String closeReason() {
        return closeReason;
    }
}
