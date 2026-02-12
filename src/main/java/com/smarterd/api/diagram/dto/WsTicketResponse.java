package com.smarterd.api.diagram.dto;

/**
 * WebSocket 일회용 ticket 발급 응답.
 *
 * @param ticket                 일회용 ticket 문자열
 * @param userId                 사용자 ID (불변 식별자)
 * @param presenceProtocolVersion presence 프로토콜 버전 (0이면 미지원)
 */
public record WsTicketResponse(String ticket, String userId, int presenceProtocolVersion) {}
