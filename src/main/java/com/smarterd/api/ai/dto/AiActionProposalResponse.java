package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.proposal.AiActionProposalView;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposalStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

@Schema(description = "AI action proposal response")
public record AiActionProposalResponse(
    @Schema(description = "Public proposal id", example = "proposal-1") String proposalId,

    @Schema(description = "Proposal status", example = "PENDING") AiActionProposalStatus status,

    @Schema(description = "Whether the proposal can still be executed", example = "true") boolean executable,

    @Schema(description = "Action type", example = "ISSUE_CREATE") String actionType,

    @Schema(description = "Risk level") AiActionRiskLevel riskLevel,

    @Schema(description = "Sanitized target metadata") AiActionProposalTargetResponse target,

    @Schema(description = "Proposal title", example = "Create issue") String title,

    @Schema(description = "Proposal summary", example = "Create a project issue") String summary,

    @Schema(description = "Field-level preview rows") List<AiActionProposalFieldChangeResponse> fields,

    @Schema(description = "Sanitized content preview") String content,

    @Schema(description = "Warnings shown before applying the proposal") List<String> warnings,

    @Schema(description = "Proposal expiration timestamp") Instant expiresAt,

    @Schema(description = "Sanitized action result") AiActionProposalResultResponse result,

    @Schema(description = "Redacted error title") String redactedErrorTitle,

    @Schema(description = "Redacted error detail") String redactedErrorDetail
) {
    public AiActionProposalResponse {
        fields = fields == null ? List.of() : List.copyOf(fields);
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }

    /**
     * Maps a sanitized proposal view into the browser-facing API contract.
     *
     * @param view sanitized proposal view
     * @return REST proposal response
     */
    public static AiActionProposalResponse from(AiActionProposalView view) {
        if (view == null) {
            return null;
        }
        return new AiActionProposalResponse(
            view.proposalId(),
            view.status(),
            view.executable(),
            view.actionType(),
            view.riskLevel(),
            AiActionProposalTargetResponse.from(view.target()),
            view.title(),
            view.summary(),
            view.fields().stream().map(AiActionProposalFieldChangeResponse::from).toList(),
            view.content(),
            view.warnings(),
            view.expiresAt(),
            AiActionProposalResultResponse.from(view.result()),
            view.redactedErrorTitle(),
            view.redactedErrorDetail()
        );
    }
}
