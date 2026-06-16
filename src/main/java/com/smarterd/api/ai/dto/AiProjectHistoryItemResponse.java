package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.history.AiProjectHistoryItemView;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * One sanitized project AI activity history item.
 *
 * @param kind history item kind
 * @param executionId execution id
 * @param proposalId proposal id
 * @param provider provider name
 * @param promptVersion prompt version
 * @param actionType action type
 * @param riskLevel risk level
 * @param status item status
 * @param targetType target type
 * @param targetId target id
 * @param targetLabel target display label
 * @param summary item summary
 * @param requestedBy requester subject
 * @param decisionBy decision actor subject
 * @param createdAt creation timestamp
 * @param decidedAt decision timestamp
 * @param redactedErrorTitle redacted error title
 * @param redactedErrorDetail redacted error detail
 * @param activityAt activity timestamp used for ordering
 */
@Schema(description = "Project AI activity history item response")
public record AiProjectHistoryItemResponse(
    @Schema(description = "History item kind", example = "execution") String kind,

    @Schema(description = "Execution id", example = "exec-1") String executionId,

    @Schema(description = "Proposal id", example = "proposal-1") String proposalId,

    @Schema(description = "Provider name", example = "noop") String provider,

    @Schema(description = "Prompt version", example = "provider-response-v1") String promptVersion,

    @Schema(description = "Action type", example = "ISSUE_CREATE") String actionType,

    @Schema(description = "Risk level", example = "LOW") String riskLevel,

    @Schema(description = "History item status", example = "PENDING") String status,

    @Schema(description = "Target type", example = "issue") String targetType,

    @Schema(description = "Target id", example = "ISS-1") String targetId,

    @Schema(description = "Target display label", example = "Follow-up") String targetLabel,

    @Schema(description = "Sanitized summary") String summary,

    @Schema(description = "Requester subject", example = "tester") String requestedBy,

    @Schema(description = "Decision actor subject", example = "tester") String decisionBy,

    @Schema(description = "Creation timestamp") Instant createdAt,

    @Schema(description = "Decision timestamp") Instant decidedAt,

    @Schema(description = "Redacted error title") String redactedErrorTitle,

    @Schema(description = "Redacted error detail") String redactedErrorDetail,

    @Schema(description = "Activity timestamp used for ordering") Instant activityAt
) {
    /**
     * Maps one sanitized history item into the API response.
     *
     * @param item sanitized history item
     * @return API item response
     */
    static AiProjectHistoryItemResponse from(AiProjectHistoryItemView item) {
        return new AiProjectHistoryItemResponse(
            item.kind(),
            item.executionId(),
            item.proposalId(),
            item.provider(),
            item.promptVersion(),
            item.actionType(),
            item.riskLevel(),
            item.status(),
            item.targetType(),
            item.targetId(),
            item.targetLabel(),
            item.summary(),
            item.requestedBy(),
            item.decisionBy(),
            item.createdAt(),
            item.decidedAt(),
            item.redactedErrorTitle(),
            item.redactedErrorDetail(),
            item.activityAt()
        );
    }
}
