package com.smarterd.application.diagram.model;

/**
 * room join 직후 application 후속 처리용 payload.
 *
 * @param snapshot 입장 직후 snapshot
 * @param joinedParticipant 완전 신규 입장 참여자
 * @param joinedPresenceVersion 신규 입장 이벤트 버전
 */
public record DiagramSessionJoinCompletion(
    DiagramPresenceSnapshotPayload snapshot,
    DiagramPresenceParticipantPayload joinedParticipant,
    long joinedPresenceVersion
) {}
