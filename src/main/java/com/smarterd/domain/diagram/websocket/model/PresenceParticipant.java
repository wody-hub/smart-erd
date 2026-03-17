package com.smarterd.domain.diagram.websocket.model;

/**
 * Presence 참여자 정보 payload.
 *
 * @param userId      사용자 ID
 * @param displayName 사용자 표시 이름
 * @param joinSeq     room 입장 순번
 */
public record PresenceParticipant(String userId, String displayName, long joinSeq) {}
