package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiChatExecutionService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AiChatRequest(
    @NotNull Long teamId,
    Long projectId,
    @NotBlank @Size(max = 4000) String userMessage,
    @Size(max = 20) String locale,
    @Size(max = 120) String routeSource
) {
    public AiChatExecutionService.ChatCommand toCommand() {
        return new AiChatExecutionService.ChatCommand(teamId, projectId, userMessage, locale, routeSource);
    }
}
