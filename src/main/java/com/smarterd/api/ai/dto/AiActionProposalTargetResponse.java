package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.proposal.AiActionProposalView;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Sanitized target metadata for an AI action proposal.
 *
 * @param type target type
 * @param id target id
 * @param label display label
 * @param teamId team id
 * @param projectId project id
 */
@Schema(description = "AI action proposal target response")
public record AiActionProposalTargetResponse(
    @Schema(description = "Target type", example = "issue") String type,

    @Schema(description = "Target id", example = "ISS-1") String id,

    @Schema(description = "Target display label", example = "Follow-up") String label,

    @Schema(description = "Team id", example = "1") Long teamId,

    @Schema(description = "Project id", example = "10") Long projectId
) {
    /**
     * Maps the sanitized target metadata for display.
     *
     * @param target sanitized target metadata
     * @return REST target response or null
     */
    static AiActionProposalTargetResponse from(AiActionProposalView.Target target) {
        if (target == null) {
            return null;
        }
        return new AiActionProposalTargetResponse(
            target.type(),
            target.id(),
            target.label(),
            target.teamId(),
            target.projectId()
        );
    }
}
