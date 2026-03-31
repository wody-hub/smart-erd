package com.smarterd.application.diagram.model;

import java.util.Arrays;
import java.util.Objects;

/**
 * room leave 직후 application 후속 처리용 payload.
 */
public final class DiagramSessionLeaveCompletion {

    private final boolean roomEmpty;
    private final byte[] drainedUpdates;
    private final String roomEpoch;
    private final String leftUserId;
    private final long leftPresenceVersion;

    public DiagramSessionLeaveCompletion(
        boolean roomEmpty,
        byte[] drainedUpdates,
        String roomEpoch,
        String leftUserId,
        long leftPresenceVersion
    ) {
        this.roomEmpty = roomEmpty;
        this.drainedUpdates = drainedUpdates == null ? null : Arrays.copyOf(drainedUpdates, drainedUpdates.length);
        this.roomEpoch = roomEpoch;
        this.leftUserId = leftUserId;
        this.leftPresenceVersion = leftPresenceVersion;
    }

    public boolean roomEmpty() {
        return roomEmpty;
    }

    public byte[] drainedUpdates() {
        return drainedUpdates == null ? null : Arrays.copyOf(drainedUpdates, drainedUpdates.length);
    }

    public String roomEpoch() {
        return roomEpoch;
    }

    public String leftUserId() {
        return leftUserId;
    }

    public long leftPresenceVersion() {
        return leftPresenceVersion;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof DiagramSessionLeaveCompletion that)) {
            return false;
        }
        return (
            roomEmpty == that.roomEmpty &&
            leftPresenceVersion == that.leftPresenceVersion &&
            Arrays.equals(drainedUpdates, that.drainedUpdates) &&
            Objects.equals(roomEpoch, that.roomEpoch) &&
            Objects.equals(leftUserId, that.leftUserId)
        );
    }

    @Override
    public int hashCode() {
        var result = Objects.hash(roomEmpty, roomEpoch, leftUserId, leftPresenceVersion);
        result = 31 * result + Arrays.hashCode(drainedUpdates);
        return result;
    }

    @Override
    public String toString() {
        return (
            "DiagramSessionLeaveCompletion[" +
            "roomEmpty=" +
            roomEmpty +
            ", drainedUpdates=" +
            Arrays.toString(drainedUpdates) +
            ", roomEpoch=" +
            roomEpoch +
            ", leftUserId=" +
            leftUserId +
            ", leftPresenceVersion=" +
            leftPresenceVersion +
            ']'
        );
    }
}
