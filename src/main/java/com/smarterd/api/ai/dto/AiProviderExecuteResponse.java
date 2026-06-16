package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.AiExecutionGateway;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

@Schema(description = "AI provider execution response")
public record AiProviderExecuteResponse(
    @Schema(description = "Execution id", example = "exec-1") String executionId,

    @Schema(description = "Provider name", example = "noop") String provider,

    @Schema(description = "Prompt version", example = "provider-response-v1") String promptVersion,

    @Schema(description = "Execution status", example = "FAILED") String status,

    @Schema(description = "Creation timestamp") Instant createdAt,

    @Schema(description = "Start timestamp") Instant startedAt,

    @Schema(description = "Completion timestamp") Instant completedAt,

    @Schema(description = "Duration in milliseconds", example = "1200") Long durationMs,

    @Schema(description = "Redacted provider answer") String answer,

    @Schema(description = "Sanitized action drafts") List<AiActionDraftResponse> actions,

    @Schema(description = "Provider error state") AiProviderErrorResponse error
) {
    public static AiProviderExecuteResponse from(AiExecutionGateway.AiExecutionView view) {
        return new AiProviderExecuteResponse(
            view.executionId(),
            view.provider(),
            view.promptVersion(),
            view.state().name(),
            view.createdAt(),
            view.startedAt(),
            view.completedAt(),
            view.durationMs(),
            view.answer(),
            view.actions().stream().map(AiActionDraftResponse::from).toList(),
            AiProviderErrorResponse.from(view.error())
        );
    }
}
