package com.smarterd.application.ai.provider;

/**
 * Replaceable AI provider port.
 */
public interface AiProvider {
    AiProviderStatus status();

    AiProviderResult execute(AiProviderRequest request);

    default void cancel(String executionId) {}
}
