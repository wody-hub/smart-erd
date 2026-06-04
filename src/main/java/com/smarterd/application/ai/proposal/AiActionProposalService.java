package com.smarterd.application.ai.proposal;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.ai.AiActionProposalRepository;
import com.smarterd.domain.ai.AiActionProposalStatus;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates and transitions sanitized AI action proposals.
 */
@Service
@RequiredArgsConstructor
public class AiActionProposalService {

    public static final Duration DEFAULT_EXPIRY = Duration.ofMinutes(15);

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final AiActionProposalRepository proposalRepository;
    private final AiActionProposalSanitizer sanitizer;
    private final AiActionProposalValidator validator;
    private final AiActionPreviewService previewService;
    private final AiActionExecutorRegistry executorRegistry;
    private final ObjectMapper objectMapper;

    @Transactional
    public List<AiActionProposalView> createProposals(CreateCommand command) {
        if (command.actions() == null || command.actions().isEmpty()) {
            return List.of();
        }
        final var now = Instant.now();
        return command
            .actions()
            .stream()
            .map(draft -> createProposal(command, draft, now))
            .map(this::toView)
            .toList();
    }

    @Transactional(readOnly = true)
    public AiActionProposalView getProposal(String loginId, String proposalId) {
        return toView(load(proposalId));
    }

    @Transactional
    public AiActionProposalView cancel(String loginId, String proposalId) {
        final var proposal = load(proposalId);
        proposal.cancel(loginId, Instant.now());
        return toView(proposal);
    }

    @Transactional
    public AiActionProposalView approve(String loginId, String proposalId) {
        final var proposal = load(proposalId);
        if (!proposal.isPending()) {
            return toView(proposal);
        }
        final var now = Instant.now();
        if (proposal.getExpiresAt() != null && !proposal.getExpiresAt().isAfter(now)) {
            proposal.expire(now);
            return toView(proposal);
        }
        try {
            validator.validateApproval(proposal, now);
        } catch (BusinessException ex) {
            proposal.reject(loginId, now, "INVALID_PROPOSAL", "Invalid proposal", "Proposal can no longer be approved.");
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
            return toView(proposal);
        }
        try {
            final var result = executor.get().execute(loginId, proposal);
            proposal.markExecuted(loginId, now, result == null ? null : result.resultJson());
        } catch (RuntimeException ex) {
            proposal.markFailed(loginId, now, ex.getClass().getSimpleName(), "Execution failed", safeDetail(ex.getMessage()));
        }
        return toView(proposal);
    }

    @Transactional
    public int expirePending(Instant now) {
        final var proposals = proposalRepository.findByStatusAndExpiresAtBefore(AiActionProposalStatus.PENDING, now);
        proposals.forEach(proposal -> proposal.expire(now));
        return proposals.size();
    }

    private AiActionProposal createProposal(CreateCommand command, AiActionDraft draft, Instant now) {
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
            writeJson(sanitizedPayload),
            writeJson(previewJson(preview))
        );
        proposal.initializeAuditActor(command.requestedBy());
        return proposalRepository.save(proposal);
    }

    private AiActionProposal load(String proposalId) {
        return proposalRepository
            .findByProposalId(proposalId)
            .orElseThrow(() -> new BusinessException(MessageCode.ERROR_NOT_FOUND_AI_EXECUTION.code()));
    }

    private AiActionProposalView toView(AiActionProposal proposal) {
        final var payload = readMap(proposal.getSanitizedPayloadJson());
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
            proposal.getRedactedErrorTitle(),
            proposal.getRedactedErrorDetail()
        );
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "{}";
        }
    }

    private Map<String, Object> previewJson(AiActionPreviewService.PreviewData preview) {
        final var json = new LinkedHashMap<String, Object>();
        json.put("fields", preview.fields());
        json.put("content", preview.content());
        json.put("warnings", preview.warnings());
        return json;
    }

    private Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private String safeDetail(String value) {
        if (value == null || value.isBlank()) {
            return "Execution failed.";
        }
        return value.length() <= 500 ? value : value.substring(0, 500);
    }

    public record CreateCommand(
        String executionId,
        String provider,
        String promptVersion,
        Long teamId,
        Long projectId,
        String requestedBy,
        List<AiActionDraft> actions
    ) {
        public CreateCommand {
            actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }
}
