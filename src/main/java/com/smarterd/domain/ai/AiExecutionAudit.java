package com.smarterd.domain.ai;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Metadata-only audit row for AI executions.
 */
@Entity
@Table(
    name = "ai_execution_audits",
    indexes = {
        @Index(name = "idx_ai_execution_audits_execution_id", columnList = "execution_id"),
        @Index(name = "idx_ai_execution_audits_project", columnList = "team_id, project_id, created_at DESC, id DESC"),
        @Index(name = "idx_ai_execution_audits_requested_by", columnList = "requested_by, created_at DESC, id DESC"),
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiExecutionAudit extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "execution_id", nullable = false, length = 80)
    private String executionId;

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(name = "prompt_version", nullable = false, length = 80)
    private String promptVersion;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "availability_status", length = 50)
    private String availabilityStatus;

    @Column(name = "error_type", length = 80)
    private String errorType;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "requested_by", nullable = false, length = 50)
    private String requestedBy;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "redacted_error_title", length = 200)
    private String redactedErrorTitle;

    @Column(name = "redacted_error_detail", length = 500)
    private String redactedErrorDetail;

    @Column(name = "proposal_id", length = 80)
    private String proposalId;

    @Column(name = "action_type", length = 80)
    private String actionType;

    @Column(name = "risk_level", length = 30)
    private String riskLevel;

    @Column(name = "target_type", length = 80)
    private String targetType;

    @Column(name = "target_id", length = 120)
    private String targetId;

    @Column(name = "target_label", length = 200)
    private String targetLabel;

    @Column(name = "decision_by", length = 50)
    private String decisionBy;

    @Column(name = "decided_at")
    private Instant decidedAt;

    public AiExecutionAudit(
        String executionId,
        String provider,
        String promptVersion,
        String status,
        String availabilityStatus,
        String errorType,
        Long durationMs,
        String requestedBy,
        Long teamId,
        Long projectId,
        String redactedErrorTitle,
        String redactedErrorDetail
    ) {
        this.executionId = executionId;
        this.provider = provider;
        this.promptVersion = promptVersion;
        this.status = status;
        this.availabilityStatus = availabilityStatus;
        this.errorType = errorType;
        this.durationMs = durationMs;
        this.requestedBy = requestedBy;
        this.teamId = teamId;
        this.projectId = projectId;
        this.redactedErrorTitle = redactedErrorTitle;
        this.redactedErrorDetail = redactedErrorDetail;
    }

    public AiExecutionAudit(
        String executionId,
        String provider,
        String promptVersion,
        String status,
        String availabilityStatus,
        String errorType,
        Long durationMs,
        String requestedBy,
        Long teamId,
        Long projectId,
        String redactedErrorTitle,
        String redactedErrorDetail,
        String proposalId,
        String actionType,
        String riskLevel,
        String targetType,
        String targetId,
        String targetLabel,
        String decisionBy,
        Instant decidedAt
    ) {
        this(
            executionId,
            provider,
            promptVersion,
            status,
            availabilityStatus,
            errorType,
            durationMs,
            requestedBy,
            teamId,
            projectId,
            redactedErrorTitle,
            redactedErrorDetail
        );
        this.proposalId = proposalId;
        this.actionType = actionType;
        this.riskLevel = riskLevel;
        this.targetType = targetType;
        this.targetId = targetId;
        this.targetLabel = targetLabel;
        this.decisionBy = decisionBy;
        this.decidedAt = decidedAt;
    }
}
