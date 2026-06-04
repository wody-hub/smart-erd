package com.smarterd.domain.ai;

/**
 * Persisted AI action proposal lifecycle states.
 */
public enum AiActionProposalStatus {
    PENDING,
    CANCELLED,
    EXPIRED,
    REJECTED,
    EXECUTED,
    FAILED,
}
