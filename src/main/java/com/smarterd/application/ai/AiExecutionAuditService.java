package com.smarterd.application.ai;

import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.ai.AiExecutionAudit;
import com.smarterd.domain.ai.AiExecutionAuditRepository;
import com.smarterd.utils.AppStringUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists metadata-only AI execution audit rows.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AiExecutionAuditService {

    private final AiExecutionAuditRepository auditRepository;

    /**
     * Records one provider execution lifecycle snapshot as sanitized audit metadata.
     *
     * @param execution provider execution snapshot
     */
    @Transactional
    public void record(AiExecutionRegistry.ExecutionSnapshot execution) {
        final var error = execution.result() == null ? null : execution.result().error();
        final var audit = new AiExecutionAudit(
            execution.executionId(),
            execution.provider(),
            execution.promptVersion(),
            execution.state().name(),
            null,
            error == null ? null : error.type(),
            execution.durationMs(),
            execution.requestedBy(),
            execution.teamId(),
            execution.projectId(),
            error == null ? null : safe(error.title(), 200),
            error == null ? null : safe(error.detail(), 500)
        );
        audit.initializeAuditActor(execution.requestedBy());
        auditRepository.save(audit);
    }

    /**
     * Records creation of a sanitized proposal without storing raw provider content.
     *
     * @param proposal sanitized proposal entity
     */
    @Transactional
    public void recordProposalCreated(AiActionProposal proposal) {
        recordProposal("PROPOSAL_CREATED", proposal);
    }

    /**
     * Records the terminal decision state for a sanitized proposal.
     *
     * @param proposal sanitized proposal entity
     */
    @Transactional
    public void recordProposalDecision(AiActionProposal proposal) {
        recordProposal("PROPOSAL_" + proposal.getStatus().name(), proposal);
    }

    /**
     * Persists proposal audit metadata shared by creation and decision rows.
     *
     * @param status audit status value
     * @param proposal sanitized proposal entity
     */
    private void recordProposal(String status, AiActionProposal proposal) {
        final var audit = new AiExecutionAudit(
            proposal.getExecutionId(),
            proposal.getProvider(),
            proposal.getPromptVersion(),
            status,
            null,
            proposal.getRedactedErrorType(),
            null,
            proposal.getRequestedBy(),
            proposal.getTeamId(),
            proposal.getProjectId(),
            safe(proposal.getRedactedErrorTitle(), 200),
            safe(proposal.getRedactedErrorDetail(), 500),
            proposal.getProposalId(),
            proposal.getActionType(),
            proposal.getRiskLevel() == null ? null : proposal.getRiskLevel().name(),
            proposal.getTargetType(),
            proposal.getTargetId(),
            safe(proposal.getTargetLabel(), 200),
            proposal.getDecisionBy(),
            proposal.getDecidedAt()
        );
        audit.initializeAuditActor(proposal.getRequestedBy());
        auditRepository.save(audit);
    }

    /**
     * Trims nullable metadata so audit rows fit the column contract.
     *
     * @param value metadata value
     * @param maxLength maximum column length
     * @return trimmed metadata or null
     */
    private String safe(String value, int maxLength) {
        if (AppStringUtils.isBlank(value)) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
