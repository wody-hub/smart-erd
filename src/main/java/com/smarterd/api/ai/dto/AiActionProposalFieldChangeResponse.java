package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.proposal.AiActionProposalView;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Sanitized field change preview row for an AI action proposal.
 *
 * @param label display label
 * @param beforeValue previous display value
 * @param afterValue next display value
 * @param changeType change type
 */
@Schema(description = "AI action proposal field change response")
public record AiActionProposalFieldChangeResponse(
    @Schema(description = "Field label", example = "Title") String label,

    @Schema(description = "Previous display value") String beforeValue,

    @Schema(description = "Next display value", example = "Follow-up") String afterValue,

    @Schema(description = "Change type", example = "ADD") String changeType
) {
    /**
     * Maps one sanitized field change preview row.
     *
     * @param field sanitized field change
     * @return REST field change response
     */
    static AiActionProposalFieldChangeResponse from(AiActionProposalView.FieldChange field) {
        return new AiActionProposalFieldChangeResponse(
            field.label(),
            field.beforeValue(),
            field.afterValue(),
            field.changeType()
        );
    }
}
