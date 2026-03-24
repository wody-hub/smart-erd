package com.smarterd.domain.diagram.websocket.mapper;

import com.smarterd.application.diagram.model.DiagramPresenceParticipantPayload;
import com.smarterd.application.diagram.model.DiagramPresenceSnapshotPayload;
import com.smarterd.application.diagram.model.DiagramSessionJoinCompletion;
import com.smarterd.application.diagram.model.DiagramSessionLeaveCompletion;
import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.model.LeaveResult;
import com.smarterd.domain.diagram.websocket.model.PresenceParticipant;
import com.smarterd.domain.diagram.websocket.model.PresenceSnapshot;
import java.util.List;

/**
 * websocket runtime model을 application payload로 변환한다.
 */
public final class DiagramApplicationPayloadMapper {

    private DiagramApplicationPayloadMapper() {}

    public static DiagramSessionJoinCompletion toJoinCompletion(JoinResult joinResult) {
        return new DiagramSessionJoinCompletion(
            toSnapshotPayload(joinResult.snapshot()),
            toParticipantPayload(joinResult.joinedParticipant()),
            joinResult.joinedPresenceVersion()
        );
    }

    public static DiagramSessionLeaveCompletion toLeaveCompletion(LeaveResult leaveResult) {
        return new DiagramSessionLeaveCompletion(
            leaveResult.roomEmpty(),
            leaveResult.drainedUpdates(),
            leaveResult.roomEpoch(),
            leaveResult.leftUserId(),
            leaveResult.leftPresenceVersion()
        );
    }

    public static DiagramPresenceSnapshotPayload toSnapshotPayload(PresenceSnapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        final List<DiagramPresenceParticipantPayload> participants = snapshot.participants()
            .stream()
            .map(DiagramApplicationPayloadMapper::toParticipantPayload)
            .toList();
        return new DiagramPresenceSnapshotPayload(snapshot.roomEpoch(), snapshot.presenceVersion(), participants);
    }

    public static DiagramPresenceParticipantPayload toParticipantPayload(PresenceParticipant participant) {
        if (participant == null) {
            return null;
        }
        return new DiagramPresenceParticipantPayload(participant.userId(), participant.displayName(), participant.joinSeq());
    }
}
