package com.smarterd.application.ai.provider;

/**
 * Safe AI provider availability states exposed to the client.
 */
public enum AiProviderAvailability {
    AVAILABLE,
    NOT_CONFIGURED,
    CODEX_NOT_FOUND,
    CODEX_NOT_LOGGED_IN,
    UNSUPPORTED_ENVIRONMENT,
}
