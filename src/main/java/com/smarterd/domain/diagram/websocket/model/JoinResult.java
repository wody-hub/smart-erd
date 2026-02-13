package com.smarterd.domain.diagram.websocket.model;

/**
 * room join 결과.
 *
 * @param accepted              입장 허용 여부
 * @param snapshot              입장 직후 스냅샷
 * @param joinedParticipant     완전 신규 입장 참여자 정보
 * @param joinedPresenceVersion 신규 입장 이벤트 버전
 */
public record JoinResult(
    boolean accepted,
    PresenceSnapshot snapshot,
    PresenceParticipant joinedParticipant,
    long joinedPresenceVersion
) {}
