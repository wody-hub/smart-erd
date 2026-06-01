package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.provider.AiActionDraft;
import java.util.Map;

public record AiActionDraftResponse(
    String id,
    String type,
    String title,
    String summary,
    String riskLevel,
    boolean requiresApproval,
    Map<String, Object> payload
) {
    public static AiActionDraftResponse from(AiActionDraft action) {
        return new AiActionDraftResponse(
            action.id(),
            action.type(),
            action.title(),
            action.summary(),
            action.riskLevel().name(),
            Boolean.TRUE.equals(action.requiresApproval()),
            action.payload()
        );
    }
}
