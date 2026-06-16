package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiChatContextView;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

/**
 * Resolved context used by an AI chat response.
 *
 * @param kind context kind
 * @param teamId team id
 * @param projectIds project ids included in the context
 * @param label display label
 * @param toolsUsed read tools used for context
 * @param caps context capability metadata
 */
@Schema(description = "AI chat context response")
public record AiChatContextResponse(
    @Schema(description = "Context kind", example = "project") String kind,

    @Schema(description = "Team id", example = "1") Long teamId,

    @Schema(description = "Project ids included in the response context", example = "[10]") List<Long> projectIds,

    @Schema(description = "Context display label", example = "Alpha Project") String label,

    @Schema(description = "Read tools used for the answer", example = "[\"ISSUES\"]") List<String> toolsUsed,

    @Schema(description = "Context capability metadata") Map<String, Object> caps
) {
    public AiChatContextResponse {
        projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
        toolsUsed = toolsUsed == null ? List.of() : List.copyOf(toolsUsed);
        caps = caps == null ? Map.of() : Map.copyOf(caps);
    }

    /**
     * Maps optional resolved chat context into a nullable API context.
     *
     * @param context application context view
     * @return REST context response or null
     */
    static AiChatContextResponse from(AiChatContextView context) {
        if (context == null) {
            return null;
        }
        return new AiChatContextResponse(
            context.kind(),
            context.teamId(),
            context.projectIds(),
            context.label(),
            context.toolsUsed(),
            context.caps()
        );
    }
}
