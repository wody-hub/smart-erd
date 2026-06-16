package com.smarterd.application.ai.provider;

/**
 * Redacted Codex process result.
 *
 * @param status process status
 * @param stdout structured stdout used only by the provider validator
 * @param errorType safe error type
 */
public record CodexProcessResult(Status status, String stdout, String errorType) {
    public enum Status {
        SUCCEEDED,
        FAILED,
        CODEX_NOT_FOUND,
        TIMED_OUT,
        CANCELLED,
        UNSUPPORTED_ENVIRONMENT,
    }
}
