package com.smarterd.application.ai.provider;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * AI action proposal skeleton. Phase 9 validates but never executes it.
 *
 * @param id provider-local action id
 * @param type action type
 * @param title display title
 * @param summary display summary
 * @param riskLevel non-destructive risk level
 * @param requiresApproval every non-empty draft must require approval
 * @param payload opaque future-phase payload
 */
public record AiActionDraft(
    @NotBlank @Size(max = 80) String id,
    @NotBlank @Size(max = 120) String type,
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 500) String summary,
    @NotNull AiActionRiskLevel riskLevel,
    Boolean requiresApproval,
    Map<String, Object> payload
) {
    public AiActionDraft {
        payload = payload == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(payload));
    }
}
