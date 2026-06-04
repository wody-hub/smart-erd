package com.smarterd.api.ai.dto;

public record AiActionProposalDecisionResponse(
    AiActionProposalResponse proposal,
    String decision,
    boolean terminal,
    String message
) {}
