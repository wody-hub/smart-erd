package com.smarterd.api.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Supported AI proposal decision values.
 */
@Schema(description = "AI proposal decision")
public enum AiActionProposalDecision {
    APPROVE,
    CANCEL,
}
