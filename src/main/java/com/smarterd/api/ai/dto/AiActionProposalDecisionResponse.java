package com.smarterd.api.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "AI proposal decision response")
public record AiActionProposalDecisionResponse(
    @Schema(description = "Proposal state after the decision") AiActionProposalResponse proposal,

    @Schema(description = "Applied decision or idempotent marker", example = "APPROVE") String decision,

    @Schema(description = "Whether the proposal is terminal after the decision", example = "true") boolean terminal,

    @Schema(description = "Stable message code", example = "ai.proposal.executed") String message
) {}
