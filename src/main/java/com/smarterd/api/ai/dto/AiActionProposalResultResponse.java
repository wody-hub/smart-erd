package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.proposal.AiActionProposalView;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Sanitized execution result for an AI action proposal.
 *
 * @param actionType action type
 * @param resourceType resource type
 * @param resourceId resource id
 * @param targetLabel target display label
 * @param status result status
 * @param summary result summary
 */
@Schema(description = "AI action proposal result response")
public record AiActionProposalResultResponse(
    @Schema(description = "Action type", example = "ISSUE_CREATE") String actionType,

    @Schema(description = "Resource type", example = "issue") String resourceType,

    @Schema(description = "Resource id", example = "ISS-1") String resourceId,

    @Schema(description = "Target display label", example = "Follow-up") String targetLabel,

    @Schema(description = "Result status", example = "CREATED") String status,

    @Schema(description = "Result summary") String summary
) {
    /**
     * Maps the sanitized result metadata for display.
     *
     * @param result sanitized result metadata
     * @return REST result response or null
     */
    static AiActionProposalResultResponse from(AiActionProposalView.Result result) {
        if (result == null) {
            return null;
        }
        return new AiActionProposalResultResponse(
            result.actionType(),
            result.resourceType(),
            result.resourceId(),
            result.targetLabel(),
            result.status(),
            result.summary()
        );
    }
}
