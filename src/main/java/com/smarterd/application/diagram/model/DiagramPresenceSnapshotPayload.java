package com.smarterd.application.diagram.model;

import java.util.List;

/**
 * application 계층에서 사용하는 presence snapshot payload.
 *
 * @param roomEpoch room epoch
 * @param presenceVersion presence 버전
 * @param participants 참여자 목록
 */
public record DiagramPresenceSnapshotPayload(
    String roomEpoch,
    long presenceVersion,
    List<DiagramPresenceParticipantPayload> participants
) {}
