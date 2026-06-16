package com.smarterd.application.ai.proposal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.AiExecutionAuditService;
import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.ai.AiActionProposalRepository;
import com.smarterd.domain.ai.AiActionProposalStatus;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates and transitions sanitized AI action proposals.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AiActionProposalService {

    public static final Duration DEFAULT_EXPIRY = Duration.ofMinutes(15);

    private final AiActionProposalRepository proposalRepository;
    private final AiActionProposalSanitizer sanitizer;
    private final AiActionProposalValidator validator;
    private final AiActionPreviewService previewService;
    private final AiActionExecutorRegistry executorRegistry;
    private final AiExecutionAuditService auditService;
    private final ProjectContextLoader projectContextLoader;
    private final ObjectMapper objectMapper;

    /**
     * Creates sanitized pending proposals from provider action drafts.
     *
     * @param command proposal creation command
     * @return sanitized proposal views
     */
    @Transactional
    public List<AiActionProposalView> createProposals(AiActionProposalCreateCommand command) {
        if (command.actions() == null || command.actions().isEmpty()) {
            return List.of();
        }
        final var now = Instant.now();
        return command
            .actions()
            .stream()
            .map((draft) -> createProposal(command, draft, now))
            .map(this::toView)
            .toList();
    }

    /**
     * Returns one proposal as a sanitized preview view.
     *
     * @param loginId requester login id
     * @param proposalId public proposal id
     * @return sanitized proposal view
     */
    public AiActionProposalView getProposal(String loginId, String proposalId) {
        return toView(loadAccessible(loginId, proposalId));
    }

    /**
     * Cancels a pending proposal idempotently and records a decision audit.
     *
     * @param loginId requester login id
     * @param proposalId public proposal id
     * @return sanitized proposal view after cancellation attempt
     */
    @Transactional
    public AiActionProposalView cancel(String loginId, String proposalId) {
        final var proposal = loadAccessible(loginId, proposalId);
        final var wasPending = proposal.isPending();
        proposal.cancel(loginId, Instant.now());
        if (wasPending) {
            auditService.recordProposalDecision(proposal);
        }
        return toView(proposal);
    }

    /**
     * Approves a pending proposal and executes it when an executor exists.
     *
     * @param loginId requester login id
     * @param proposalId public proposal id
     * @return sanitized proposal view after approval attempt
     */
    @Transactional
    public AiActionProposalView approve(String loginId, String proposalId) {
        final var proposal = loadAccessible(loginId, proposalId);
        if (!proposal.isPending()) {
            return toView(proposal);
        }
        final var now = Instant.now();
        if (proposal.getExpiresAt() != null && !proposal.getExpiresAt().isAfter(now)) {
            proposal.expire(now);
            auditService.recordProposalDecision(proposal);
            return toView(proposal);
        }
        try {
            validator.validateApproval(proposal, now);
        } catch (BusinessException ex) {
            proposal.reject(
                loginId,
                now,
                "INVALID_PROPOSAL",
                "Invalid proposal",
                "Proposal can no longer be approved."
            );
            auditService.recordProposalDecision(proposal);
            return toView(proposal);
        }
        final var executor = executorRegistry.find(proposal.getActionType());
        if (executor.isEmpty()) {
            proposal.reject(
                loginId,
                now,
                "UNSUPPORTED_ACTION",
                "Unsupported action",
                "No executor is registered for this action type."
            );
            auditService.recordProposalDecision(proposal);
            return toView(proposal);
        }
        try {
            final var result = executor.get().execute(loginId, proposal);
            proposal.markExecuted(loginId, now, result == null ? null : result.resultJson());
        } catch (RuntimeException ex) {
            proposal.markFailed(
                loginId,
                now,
                ex.getClass().getSimpleName(),
                "Execution failed",
                AiActionProposalJsonSupport.safeDetail(ex.getMessage())
            );
        }
        auditService.recordProposalDecision(proposal);
        return toView(proposal);
    }

    /**
     * Expires all pending proposals whose expiry time has passed.
     *
     * @param now current timestamp for expiry comparison
     * @return number of expired proposals
     */
    @Transactional
    public int expirePending(Instant now) {
        final var proposals = proposalRepository.findByStatusAndExpiresAtBefore(AiActionProposalStatus.PENDING, now);
        proposals.forEach((proposal) -> {
            proposal.expire(now);
            auditService.recordProposalDecision(proposal);
        });
        return proposals.size();
    }

    /**
     * Sanitizes, validates, previews, persists, and audits a single action draft.
     *
     * @param command proposal creation command
     * @param draft provider action draft
     * @param now creation timestamp
     * @return persisted proposal entity
     */
    private AiActionProposal createProposal(AiActionProposalCreateCommand command, AiActionDraft draft, Instant now) {
        final var sanitizedPayload = sanitizer.sanitize(draft.payload());
        validator.validateDraft(draft, sanitizedPayload);
        final var preview = previewService.preview(command.teamId(), command.projectId(), sanitizedPayload);
        final var proposal = new AiActionProposal(
            UUID.randomUUID().toString(),
            command.executionId(),
            command.provider(),
            command.promptVersion(),
            draft.type(),
            draft.riskLevel(),
            command.teamId(),
            command.projectId(),
            preview.target().type(),
            preview.target().id(),
            preview.target().label(),
            draft.title(),
            draft.summary(),
            command.requestedBy(),
            now.plus(DEFAULT_EXPIRY),
            AiActionProposalJsonSupport.writeJson(objectMapper, sanitizedPayload),
            AiActionProposalJsonSupport.writeJson(objectMapper, AiActionProposalJsonSupport.previewJson(preview))
        );
        proposal.initializeAuditActor(command.requestedBy());
        final var saved = proposalRepository.save(proposal);
        auditService.recordProposalCreated(saved);
        return saved;
    }

    /**
     * Loads one proposal by public proposal id.
     *
     * @param proposalId public proposal id
     * @return proposal entity
     */
    private AiActionProposal load(String proposalId) {
        return proposalRepository
            .findByProposalId(proposalId)
            .orElseThrow(() -> new BusinessException(MessageCode.ERROR_NOT_FOUND_AI_PROPOSAL.code()));
    }

    /**
     * Loads one proposal and verifies the actor can access its project.
     *
     * @param loginId requester login id
     * @param proposalId public proposal id
     * @return authorized proposal entity
     */
    private AiActionProposal loadAccessible(String loginId, String proposalId) {
        final var proposal = load(proposalId);
        projectContextLoader.load(loginId, proposal.getTeamId(), proposal.getProjectId(), false);
        return proposal;
    }

    /**
     * Rehydrates sanitized payload JSON into a browser-safe preview view.
     *
     * @param proposal proposal entity
     * @return sanitized proposal view
     */
    private AiActionProposalView toView(AiActionProposal proposal) {
        final var payload = AiActionProposalJsonSupport.readMap(objectMapper, proposal.getSanitizedPayloadJson());
        final var preview = previewService.preview(proposal.getTeamId(), proposal.getProjectId(), payload);
        final var executable = proposal.isPending() && executorRegistry.find(proposal.getActionType()).isPresent();
        return new AiActionProposalView(
            proposal.getProposalId(),
            proposal.getStatus(),
            executable,
            proposal.getActionType(),
            proposal.getRiskLevel(),
            new AiActionProposalView.Target(
                proposal.getTargetType(),
                proposal.getTargetId(),
                proposal.getTargetLabel(),
                proposal.getTeamId(),
                proposal.getProjectId()
            ),
            proposal.getTitle(),
            proposal.getSummary(),
            preview.fields(),
            preview.content(),
            preview.warnings(),
            proposal.getExpiresAt(),
            AiActionProposalJsonSupport.resultView(objectMapper, proposal.getResultJson()),
            proposal.getRedactedErrorTitle(),
            proposal.getRedactedErrorDetail()
        );
    }
}
