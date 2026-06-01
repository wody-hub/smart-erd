package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.AiExecutionGateway;
import java.time.Instant;
import java.util.List;

public record AiProviderExecuteResponse(
    String executionId,
    String provider,
    String promptVersion,
    String status,
    Instant createdAt,
    Instant startedAt,
    Instant completedAt,
    Long durationMs,
    String answer,
    List<AiActionDraftResponse> actions,
    AiProviderErrorResponse error
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
