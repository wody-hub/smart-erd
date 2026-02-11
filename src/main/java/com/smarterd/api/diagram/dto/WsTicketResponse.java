package com.smarterd.api.diagram.dto;

/**
 * WebSocket 일회용 ticket 발급 응답.
 *
 * @param ticket 일회용 ticket 문자열
 */
public record WsTicketResponse(String ticket) {}
