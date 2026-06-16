package com.smarterd.application.ai.chat;

import java.util.List;
import java.util.Map;

public record AiChatContextView(
    String kind,
    Long teamId,
    List<Long> projectIds,
    String label,
    List<String> toolsUsed,
    Map<String, Object> caps
) {
    public AiChatContextView {
        projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
        toolsUsed = toolsUsed == null ? List.of() : List.copyOf(toolsUsed);
        caps = caps == null ? Map.of() : Map.copyOf(caps);
    }
}
