package com.smarterd.application.diagram.model;

/**
 * application 계층에서 사용하는 presence 참여자 payload.
 *
 * @param userId 사용자 ID
 * @param displayName 사용자 표시 이름
 * @param joinSeq room 입장 순번
 */
public record DiagramPresenceParticipantPayload(String userId, String displayName, long joinSeq) {}
