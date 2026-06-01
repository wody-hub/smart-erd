package com.smarterd.application.ai.provider;

import java.time.Instant;

/**
 * Safe provider status response.
 *
 * @param provider provider id
 * @param availability availability enum
 * @param message optional safe message
 * @param checkedAt status check timestamp
 */
public record AiProviderStatus(
    String provider,
    AiProviderAvailability availability,
    String message,
    Instant checkedAt
) {}
