package com.smarterd.domain.diagram.websocket.model;

import java.util.List;

/**
 * Presence snapshot payload.
 *
 * @param roomEpoch       room epoch
 * @param presenceVersion presence 버전
 * @param participants    참여자 목록
 */
public record PresenceSnapshot(String roomEpoch, long presenceVersion, List<PresenceParticipant> participants) {}
