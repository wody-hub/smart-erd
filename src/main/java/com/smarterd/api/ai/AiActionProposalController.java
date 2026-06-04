package com.smarterd.api.ai;

import com.smarterd.api.ai.dto.AiActionProposalDecisionResponse;
import com.smarterd.api.ai.dto.AiActionProposalResponse;
import com.smarterd.application.ai.proposal.AiActionProposalService;
import com.smarterd.application.ai.proposal.AiActionProposalView;
import com.smarterd.domain.ai.AiActionProposalStatus;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Approval-preview endpoints for sanitized AI action proposals.
 */
@RestController
@RequestMapping("/api/ai/proposals")
@RequiredArgsConstructor
public class AiActionProposalController {

    private final AiActionProposalService proposalService;

    /**
     * Returns the sanitized preview for one AI action proposal.
     *
     * @param jwt authenticated principal
     * @param proposalId public proposal id
     * @return sanitized proposal response
     */
    @GetMapping("/{proposalId}")
    public ResponseEntity<AiActionProposalResponse> getProposal(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String proposalId
    ) {
        return ResponseEntity.ok(AiActionProposalResponse.from(proposalService.getProposal(subject(jwt), proposalId)));
    }

    /**
     * Approves a pending AI proposal and returns its final proposal state.
     *
     * @param jwt authenticated principal
     * @param proposalId public proposal id
     * @return decision response with final proposal state
     */
    @PostMapping("/{proposalId}/approve")
    public ResponseEntity<AiActionProposalDecisionResponse> approve(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String proposalId
    ) {
        final var actor = subject(jwt);
        final var before = proposalService.getProposal(actor, proposalId);
        final var after = proposalService.approve(actor, proposalId);
        return ResponseEntity.ok(decisionResponse(before.status(), after, "APPROVE"));
    }

    /**
     * Cancels a pending AI proposal and returns its final proposal state.
     *
     * @param jwt authenticated principal
     * @param proposalId public proposal id
     * @return decision response with final proposal state
     */
    @PostMapping("/{proposalId}/cancel")
    public ResponseEntity<AiActionProposalDecisionResponse> cancel(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String proposalId
    ) {
        final var actor = subject(jwt);
        final var before = proposalService.getProposal(actor, proposalId);
        final var after = proposalService.cancel(actor, proposalId);
        return ResponseEntity.ok(decisionResponse(before.status(), after, "CANCEL"));
    }

    /**
     * Extracts the authenticated login id or raises the shared AI access error.
     *
     * @param jwt authenticated principal
     * @return login id subject
     */
    private static String subject(Jwt jwt) {
        if (jwt == null) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code());
        }
        return jwt.getSubject();
    }

    /**
     * Builds the stable decision response for approve/cancel attempts.
     *
     * @param before status before the decision attempt
     * @param after proposal view after the decision attempt
     * @param requestedDecision requested decision label
     * @return API decision response
     */
    private static AiActionProposalDecisionResponse decisionResponse(
        AiActionProposalStatus before,
        AiActionProposalView after,
        String requestedDecision
    ) {
        return new AiActionProposalDecisionResponse(
            AiActionProposalResponse.from(after),
            before == AiActionProposalStatus.PENDING ? requestedDecision : "IDEMPOTENT",
            after.status() != AiActionProposalStatus.PENDING,
            decisionMessage(before, after.status())
        );
    }

    /**
     * Selects a stable message code for the before/after decision transition.
     *
     * @param before status before the decision attempt
     * @param after status after the decision attempt
     * @return message code for the transition
     */
    private static String decisionMessage(AiActionProposalStatus before, AiActionProposalStatus after) {
        if (before != AiActionProposalStatus.PENDING) {
            return MessageCode.ERROR_BUSINESS_AI_PROPOSAL_TERMINAL.code();
        }
        return switch (after) {
            case EXECUTED -> "ai.proposal.executed";
            case CANCELLED -> "ai.proposal.cancelled";
            case EXPIRED -> MessageCode.ERROR_BUSINESS_AI_PROPOSAL_EXPIRED.code();
            case REJECTED -> MessageCode.ERROR_BUSINESS_AI_PROPOSAL_UNSUPPORTED_ACTION.code();
            case FAILED -> "ai.proposal.failed";
            case PENDING -> MessageCode.ERROR_BUSINESS_AI_PROPOSAL_INVALID_OR_STALE.code();
        };
    }
}
