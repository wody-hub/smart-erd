package com.smarterd.application.ai.provider;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Structured AI provider result.
 *
 * @param answer user-facing answer, nullable only when error is present
 * @param actions proposed action skeletons, never executed in Phase 9
 * @param error redacted provider error
 */
public record AiProviderResult(
    @Size(max = 4000) String answer,
    @Valid List<AiActionDraft> actions,
    @Valid AiProviderError error
) {
    public AiProviderResult {
        actions = actions == null ? List.of() : List.copyOf(actions);
    }

    public static AiProviderResult answer(String answer) {
        return new AiProviderResult(answer, List.of(), null);
    }

    public static AiProviderResult failed(AiProviderError error) {
        return new AiProviderResult(null, List.of(), error);
    }
}
