package com.smarterd.application.ai.chat;

import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Builds source chips from backend read-tool result counts.
 */
@Service
public class AiSourceChipFactory {

    public List<AiReadContextService.SourceChip> fromToolResults(List<AiReadContextService.ToolReadResult> results) {
        if (results == null || results.isEmpty()) {
            return List.of();
        }
        return results
            .stream()
            .map(result -> new AiReadContextService.SourceChip(result.projectName(), result.tool(), result.count()))
            .toList();
    }
}
