package com.smarterd.api.ai;

import static com.smarterd.api.ai.AiAuthenticationSupport.subject;

import com.smarterd.api.ai.dto.AiActionProposalDecisionRequest;
import com.smarterd.api.ai.dto.AiActionProposalDecisionResponse;
import com.smarterd.api.ai.dto.AiActionProposalResponse;
import com.smarterd.application.ai.proposal.AiActionProposalService;
import com.smarterd.application.ai.proposal.AiActionProposalView;
import com.smarterd.domain.ai.AiActionProposalStatus;
import com.smarterd.domain.common.message.MessageCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Approval-preview endpoints for sanitized AI action proposals.
 */
@Tag(name = "AI Proposals", description = "Sanitized AI action proposal review APIs")
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
    @Operation(summary = "Get AI proposal", description = "Returns a sanitized AI action proposal preview.")
    @ApiResponse(
        responseCode = "200",
        description = "Proposal returned",
        content = @Content(schema = @Schema(implementation = AiActionProposalResponse.class))
    )
    @ApiResponse(responseCode = "403", description = "AI proposal access denied", content = @Content)
    @GetMapping("/{proposalId}")
    public ResponseEntity<AiActionProposalResponse> getProposal(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String proposalId
    ) {
        return ResponseEntity.ok(AiActionProposalResponse.from(proposalService.getProposal(subject(jwt), proposalId)));
    }

    /**
     * Applies one proposal decision and returns the final proposal state.
     *
     * @param jwt authenticated principal
     * @param proposalId public proposal id
     * @param request requested proposal decision
     * @return decision response with final proposal state
     */
    @Operation(summary = "Create AI proposal decision", description = "Approves or cancels one pending AI proposal.")
    @ApiResponse(
        responseCode = "200",
        description = "Decision applied",
        content = @Content(schema = @Schema(implementation = AiActionProposalDecisionResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "Invalid decision request", content = @Content)
    @ApiResponse(responseCode = "403", description = "AI proposal access denied", content = @Content)
    @PostMapping("/{proposalId}/decisions")
    public ResponseEntity<AiActionProposalDecisionResponse> decide(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String proposalId,
        @Valid @RequestBody AiActionProposalDecisionRequest request
    ) {
        final var actor = subject(jwt);
        final var before = proposalService.getProposal(actor, proposalId);
        final var after = switch (request.decision()) {
            case APPROVE -> proposalService.approve(actor, proposalId);
            case CANCEL -> proposalService.cancel(actor, proposalId);
        };
        return ResponseEntity.ok(decisionResponse(before.status(), after, request.decision().name()));
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
