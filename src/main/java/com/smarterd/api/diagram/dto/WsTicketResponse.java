package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * WebSocket 일회용 ticket 발급 응답.
 *
 * @param ticket                 일회용 ticket 문자열
 * @param userId                 사용자 ID (불변 식별자)
 * @param presenceProtocolVersion presence 프로토콜 버전 (0이면 미지원)
 */
@Schema(description = "WebSocket ticket 발급 응답")
public record WsTicketResponse(
    @Schema(description = "일회용 ticket 문자열") String ticket,
    @Schema(description = "사용자 ID") String userId,
    @Schema(description = "presence 프로토콜 버전", example = "1") int presenceProtocolVersion
) {}
