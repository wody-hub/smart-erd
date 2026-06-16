package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * WebSocket 일회용 ticket 발급 요청.
 *
 * @param diagramId 접속 대상 다이어그램 ID
 */
@Schema(description = "WebSocket ticket 발급 요청")
public record WsTicketRequest(
    @Schema(description = "접속 대상 다이어그램 ID", example = "1")
    @NotNull(message = "{validation.not-null.ws-ticket-diagram-id}")
    Long diagramId
) {}
