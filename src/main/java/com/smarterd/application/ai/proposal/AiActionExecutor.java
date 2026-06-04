package com.smarterd.application.ai.proposal;

import com.smarterd.domain.ai.AiActionProposal;

/**
 * Future Phase 12 boundary for concrete low-risk AI write executors.
 */
public interface AiActionExecutor {
    String actionType();

    ExecutionResult execute(String loginId, AiActionProposal proposal);

    record ExecutionResult(String resultJson) {}
}
