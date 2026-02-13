package com.smarterd.domain.diagram.websocket.model;

/**
 * room leave 결과.
 *
 * @param roomEmpty           방이 비었는지 여부
 * @param drainedUpdates      방이 비었으면 원자적으로 drain된 update
 * @param roomEpoch           room epoch (없으면 null)
 * @param leftUserId          완전 퇴장한 사용자 ID (없으면 null)
 * @param leftPresenceVersion 완전 퇴장 이벤트 버전 (없으면 0)
 */
public record LeaveResult(
    boolean roomEmpty,
    byte[] drainedUpdates,
    String roomEpoch,
    String leftUserId,
    long leftPresenceVersion
) {}
