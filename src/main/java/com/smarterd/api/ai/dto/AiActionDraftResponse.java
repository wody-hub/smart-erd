package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.provider.AiActionDraft;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

@Schema(description = "AI action draft response")
public record AiActionDraftResponse(
    @Schema(description = "Action draft id", example = "action-1") String id,

    @Schema(description = "Action draft type", example = "ISSUE_CREATE") String type,

    @Schema(description = "Action title", example = "Create issue") String title,

    @Schema(description = "Action summary") String summary,

    @Schema(description = "Risk level", example = "LOW") String riskLevel,

    @Schema(description = "Whether approval is required", example = "true") boolean requiresApproval,

    @Schema(description = "Sanitized action payload") Map<String, Object> payload
) {
    public static AiActionDraftResponse from(AiActionDraft action) {
        return new AiActionDraftResponse(
            action.id(),
            action.type(),
            action.title(),
            action.summary(),
            action.riskLevel().name(),
            Boolean.TRUE.equals(action.requiresApproval()),
            action.payload()
        );
    }
}
