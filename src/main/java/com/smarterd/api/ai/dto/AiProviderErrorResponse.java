package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.provider.AiProviderError;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "AI provider error response")
public record AiProviderErrorResponse(
    @Schema(description = "Error type", example = "NOT_CONFIGURED") String type,

    @Schema(description = "Redacted error title", example = "Not configured") String title,

    @Schema(description = "Redacted error detail") String detail,

    @Schema(description = "Whether retry is safe", example = "false") boolean retryable
) {
    public static AiProviderErrorResponse from(AiProviderError error) {
        if (error == null) {
            return null;
        }
        return new AiProviderErrorResponse(error.type(), error.title(), error.detail(), error.retryable());
    }
}
