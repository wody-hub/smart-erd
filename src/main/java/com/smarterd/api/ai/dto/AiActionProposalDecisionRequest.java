package com.smarterd.api.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Request body for applying one AI proposal decision.
 *
 * @param decision requested proposal decision
 */
@Schema(description = "AI proposal decision request")
public record AiActionProposalDecisionRequest(
    @Schema(description = "Decision to apply to the proposal", example = "APPROVE")
    @NotNull(message = "{validation.not-null.ai-proposal-decision}")
    AiActionProposalDecision decision
) {}
