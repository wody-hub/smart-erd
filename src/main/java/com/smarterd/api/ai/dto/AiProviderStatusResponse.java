package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.AiExecutionGateway;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "AI provider status response")
public record AiProviderStatusResponse(
    @Schema(description = "Provider name", example = "noop") String provider,

    @Schema(description = "Provider availability", example = "NOT_CONFIGURED") String availability,

    @Schema(description = "Provider status message") String message,

    @Schema(description = "Status check timestamp") Instant checkedAt
) {
    public static AiProviderStatusResponse from(AiExecutionGateway.AiProviderStatusView status) {
        return new AiProviderStatusResponse(
            status.provider(),
            status.availability(),
            status.message(),
            status.checkedAt()
        );
    }
}
