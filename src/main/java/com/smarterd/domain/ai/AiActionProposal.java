package com.smarterd.domain.ai;

import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.common.entity.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Server-owned, sanitized proposal created from an AI action draft.
 */
@Entity
@Table(
    name = "ai_action_proposals",
    indexes = {
        @Index(name = "idx_ai_action_proposals_proposal_id", columnList = "proposal_id"),
        @Index(name = "idx_ai_action_proposals_execution_id", columnList = "execution_id"),
        @Index(name = "idx_ai_action_proposals_project", columnList = "team_id, project_id, created_at DESC, id DESC"),
        @Index(name = "idx_ai_action_proposals_requested_by", columnList = "requested_by, created_at DESC, id DESC"),
        @Index(name = "idx_ai_action_proposals_status_expiry", columnList = "status, expires_at"),
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiActionProposal extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "proposal_id", nullable = false, unique = true, length = 80)
    private String proposalId;

    @Column(name = "execution_id", nullable = false, length = 80)
    private String executionId;

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(name = "prompt_version", nullable = false, length = 80)
    private String promptVersion;

    @Column(name = "action_type", nullable = false, length = 120)
    private String actionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false, length = 30)
    private AiActionRiskLevel riskLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AiActionProposalStatus status = AiActionProposalStatus.PENDING;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "target_type", length = 80)
    private String targetType;

    @Column(name = "target_id", length = 120)
    private String targetId;

    @Column(name = "target_label", length = 200)
    private String targetLabel;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 500)
    private String summary;

    @Column(name = "requested_by", nullable = false, length = 50)
    private String requestedBy;

    @Column(name = "decision_by", length = 50)
    private String decisionBy;

    @Column(name = "decided_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
    private Instant decidedAt;

    @Column(name = "expires_at", nullable = false, columnDefinition = "TIMESTAMP WITH TIME ZONE")
    private Instant expiresAt;

    @Column(name = "sanitized_payload_json", columnDefinition = "TEXT")
    private String sanitizedPayloadJson;

    @Column(name = "preview_json", columnDefinition = "TEXT")
    private String previewJson;

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "redacted_error_type", length = 80)
    private String redactedErrorType;

    @Column(name = "redacted_error_title", length = 200)
    private String redactedErrorTitle;

    @Column(name = "redacted_error_detail", length = 500)
    private String redactedErrorDetail;

    public AiActionProposal(
        String proposalId,
        String executionId,
        String provider,
        String promptVersion,
        String actionType,
        AiActionRiskLevel riskLevel,
        Long teamId,
        Long projectId,
        String targetType,
        String targetId,
        String targetLabel,
        String title,
        String summary,
        String requestedBy,
        Instant expiresAt,
        String sanitizedPayloadJson,
        String previewJson
    ) {
        this.proposalId = proposalId;
        this.executionId = executionId;
        this.provider = provider;
        this.promptVersion = promptVersion;
        this.actionType = actionType;
        this.riskLevel = riskLevel;
        this.teamId = teamId;
        this.projectId = projectId;
        this.targetType = targetType;
        this.targetId = targetId;
        this.targetLabel = targetLabel;
        this.title = title;
        this.summary = summary;
        this.requestedBy = requestedBy;
        this.expiresAt = expiresAt;
        this.sanitizedPayloadJson = sanitizedPayloadJson;
        this.previewJson = previewJson;
    }

    public boolean isPending() {
        return status == AiActionProposalStatus.PENDING;
    }

    public boolean isTerminal() {
        return status != AiActionProposalStatus.PENDING;
    }

    public void cancel(String actor, Instant decidedAt) {
        if (!isPending()) {
            return;
        }
        transition(AiActionProposalStatus.CANCELLED, actor, decidedAt, null, null, null, null);
    }

    public void expire(Instant decidedAt) {
        if (!isPending()) {
            return;
        }
        transition(AiActionProposalStatus.EXPIRED, null, decidedAt, null, null, null, null);
    }

    public void reject(String actor, Instant decidedAt, String errorType, String errorTitle, String errorDetail) {
        if (!isPending()) {
            return;
        }
        transition(AiActionProposalStatus.REJECTED, actor, decidedAt, null, errorType, errorTitle, errorDetail);
    }

    public void markExecuted(String actor, Instant decidedAt, String resultJson) {
        if (!isPending()) {
            return;
        }
        transition(AiActionProposalStatus.EXECUTED, actor, decidedAt, resultJson, null, null, null);
    }

    public void markFailed(String actor, Instant decidedAt, String errorType, String errorTitle, String errorDetail) {
        if (!isPending()) {
            return;
        }
        transition(AiActionProposalStatus.FAILED, actor, decidedAt, null, errorType, errorTitle, errorDetail);
    }

    private void transition(
        AiActionProposalStatus nextStatus,
        String actor,
        Instant at,
        String resultJson,
        String errorType,
        String errorTitle,
        String errorDetail
    ) {
        this.status = nextStatus;
        this.decisionBy = actor;
        this.decidedAt = at;
        this.resultJson = resultJson;
        this.redactedErrorType = errorType;
        this.redactedErrorTitle = errorTitle;
        this.redactedErrorDetail = errorDetail;
        initializeAuditActor(actor);
    }
}
