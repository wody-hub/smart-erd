package com.smarterd.application.ai.provider;

import java.util.Map;

/**
 * Sanitized provider request.
 *
 * @param executionId execution id
 * @param promptVersion prompt version
 * @param userMessage user message
 * @param locale request locale
 * @param context sanitized metadata-only context
 */
public record AiProviderRequest(
    String executionId,
    String promptVersion,
    String userMessage,
    String locale,
    Map<String, Object> context
) {
    public AiProviderRequest {
        context = context == null ? Map.of() : Map.copyOf(context);
    }
}
