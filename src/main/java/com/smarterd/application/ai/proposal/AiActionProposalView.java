package com.smarterd.application.ai.proposal;

import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposalStatus;
import java.time.Instant;
import java.util.List;

/**
 * Sanitized proposal view safe for API responses and browser persistence.
 */
public record AiActionProposalView(
    String proposalId,
    AiActionProposalStatus status,
    boolean executable,
    String actionType,
    AiActionRiskLevel riskLevel,
    Target target,
    String title,
    String summary,
    List<FieldChange> fields,
    String content,
    List<String> warnings,
    Instant expiresAt,
    String redactedErrorTitle,
    String redactedErrorDetail
) {
    public AiActionProposalView {
        fields = fields == null ? List.of() : List.copyOf(fields);
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }

    public record Target(String type, String id, String label, Long teamId, Long projectId) {}

    public record FieldChange(String label, String beforeValue, String afterValue, String changeType) {}
}
