package com.smarterd.application.ai.provider;

import java.time.Clock;

/**
 * Safe default provider used until a real provider is configured.
 */
public class NoopAiProvider implements AiProvider {

    private final Clock clock;

    public NoopAiProvider(Clock clock) {
        this.clock = clock;
    }

    @Override
    public AiProviderStatus status() {
        return new AiProviderStatus(
            "noop",
            AiProviderAvailability.NOT_CONFIGURED,
            "AI provider is not configured.",
            clock.instant()
        );
    }

    @Override
    public AiProviderResult execute(AiProviderRequest request) {
        return AiProviderResult.failed(
            new AiProviderError(
                "NOT_CONFIGURED",
                "AI provider is not configured",
                "No AI provider is configured.",
                false
            )
        );
    }
}
