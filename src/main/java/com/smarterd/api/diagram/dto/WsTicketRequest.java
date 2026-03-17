package com.smarterd.api.diagram.dto;

import jakarta.validation.constraints.NotNull;

/**
 * WebSocket 일회용 ticket 발급 요청.
 *
 * @param diagramId 접속 대상 다이어그램 ID
 */
public record WsTicketRequest(@NotNull Long diagramId) {}
