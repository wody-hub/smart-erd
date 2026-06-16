package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiReadContextService;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "AI chat source chip response")
public record AiChatSourceChipResponse(
    @Schema(description = "Project name", example = "Alpha Project") String projectName,

    @Schema(description = "Read tool name", example = "issues") String tool,

    @Schema(description = "Fact count", example = "12") int count,

    @Schema(description = "Team name", example = "Platform Team") String teamName,

    @Schema(description = "Project id", example = "10") Long projectId
) {
    public AiChatSourceChipResponse(String projectName, String tool, int count) {
        this(projectName, tool, count, null, null);
    }

    public static AiChatSourceChipResponse from(AiReadContextService.SourceChip sourceChip) {
        return new AiChatSourceChipResponse(sourceChip.projectName(), sourceChip.tool(), sourceChip.count());
    }
}
