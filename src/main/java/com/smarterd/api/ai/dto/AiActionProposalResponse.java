package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.proposal.AiActionProposalView;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposalStatus;
import java.time.Instant;
import java.util.List;

public record AiActionProposalResponse(
    String proposalId,
    AiActionProposalStatus status,
    boolean executable,
    String actionType,
    AiActionRiskLevel riskLevel,
    TargetResponse target,
    String title,
    String summary,
    List<FieldChangeResponse> fields,
    String content,
    List<String> warnings,
    Instant expiresAt,
    ResultResponse result,
    String redactedErrorTitle,
    String redactedErrorDetail
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
            TargetResponse.from(view.target()),
            view.title(),
            view.summary(),
            view.fields().stream().map(FieldChangeResponse::from).toList(),
            view.content(),
            view.warnings(),
            view.expiresAt(),
            ResultResponse.from(view.result()),
            view.redactedErrorTitle(),
            view.redactedErrorDetail()
        );
    }

    public record TargetResponse(String type, String id, String label, Long teamId, Long projectId) {
        /**
         * Maps the sanitized target metadata for display.
         *
         * @param target sanitized target metadata
         * @return REST target response or null
         */
        private static TargetResponse from(AiActionProposalView.Target target) {
            if (target == null) {
                return null;
            }
            return new TargetResponse(target.type(), target.id(), target.label(), target.teamId(), target.projectId());
        }
    }

    public record FieldChangeResponse(String label, String beforeValue, String afterValue, String changeType) {
        /**
         * Maps one sanitized field change preview row.
         *
         * @param field sanitized field change
         * @return REST field change response
         */
        private static FieldChangeResponse from(AiActionProposalView.FieldChange field) {
            return new FieldChangeResponse(field.label(), field.beforeValue(), field.afterValue(), field.changeType());
        }
    }

    public record ResultResponse(
        String actionType,
        String resourceType,
        String resourceId,
        String targetLabel,
        String status,
        String summary
    ) {
        private static ResultResponse from(AiActionProposalView.Result result) {
            if (result == null) {
                return null;
            }
            return new ResultResponse(
                result.actionType(),
                result.resourceType(),
                result.resourceId(),
                result.targetLabel(),
                result.status(),
                result.summary()
            );
        }
    }
}
