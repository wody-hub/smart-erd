package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiChatErrorView;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Structured error state for an AI chat response.
 *
 * @param code stable error code
 * @param message redacted display message
 * @param retryable whether retry is safe
 */
@Schema(description = "AI chat error response")
public record AiChatErrorResponse(
    @Schema(description = "Stable error code", example = "NOT_CONFIGURED") String code,

    @Schema(description = "Redacted display message", example = "AI provider is not configured.") String message,

    @Schema(description = "Whether retry is safe", example = "false") boolean retryable
) {
    /**
     * Maps optional provider or chat error state into the API error card.
     *
     * @param error application error view
     * @return REST error response or null
     */
    static AiChatErrorResponse from(AiChatErrorView error) {
        if (error == null) {
            return null;
        }
        return new AiChatErrorResponse(error.code(), error.message(), error.retryable());
    }
}
