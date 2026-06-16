package com.smarterd.api.ai.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.smarterd.application.ai.chat.AiChatCommand;
import com.smarterd.utils.AppStringUtils;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.lang.Nullable;

@Schema(description = "AI chat execution request")
public record AiChatRequest(
    @Schema(description = "User message for the AI chat harness", example = "프로젝트 리스크를 요약해줘")
    @JsonAlias("userMessage")
    @NotBlank(message = "{validation.not-blank.ai-chat-message}")
    @Size(max = 4000, message = "{validation.size.ai-chat-message}")
    String message,

    @Schema(description = "Team id for the chat context", example = "1") Long teamId,

    @Schema(description = "Project id for the chat context", example = "10") Long projectId,

    @Schema(description = "Project name captured by the frontend route", example = "Alpha")
    @Size(max = 120, message = "{validation.size.ai-chat-project-name}")
    String projectName,

    @Schema(description = "Requested chat scope mode", example = "PROJECT")
    @Size(max = 40, message = "{validation.size.ai-chat-scope-mode}")
    String scopeMode,

    @Schema(description = "Preferred locale", example = "ko")
    @Size(max = 20, message = "{validation.size.ai-locale}")
    String locale,

    @Schema(description = "Route-derived chat context") @Valid AiChatContextRequest context,

    @Schema(description = "User-selected chat context override") @Valid AiChatContextRequest selectedContext
) {
    /**
     * Converts the API request into the application chat command.
     *
     * @return normalized application chat command
     */
    public AiChatCommand toCommand() {
        final var effectiveContext = selectedContext == null ? context : selectedContext;
        final var effectiveTeamId = teamId == null && effectiveContext != null ? effectiveContext.teamId() : teamId;
        final var effectiveProjectId =
            projectId == null && effectiveContext != null ? effectiveContext.projectId() : projectId;
        final var effectiveProjectName =
            blankToNull(projectName) == null && effectiveContext != null ? effectiveContext.projectName() : projectName;
        final var effectiveScopeMode = blankToNull(scopeMode);
        final var contextKind = effectiveContext == null ? "" : nullToEmpty(effectiveContext.kind());
        return new AiChatCommand(
            effectiveTeamId,
            effectiveProjectId,
            message,
            locale,
            routeSource(effectiveContext),
            effectiveProjectName,
            effectiveScopeMode,
            isCurrentTeamMode(effectiveScopeMode, contextKind),
            isMultiProjectMode(effectiveScopeMode, contextKind)
        );
    }

    private static String routeSource(@Nullable AiChatContextRequest context) {
        if (context == null) {
            return null;
        }
        final var source = blankToNull(context.source());
        if (source != null) {
            return source;
        }
        return context.kind();
    }

    private static boolean isCurrentTeamMode(@Nullable String scopeMode, String contextKind) {
        final var normalizedScope = AppStringUtils.upperCaseToEmpty(scopeMode);
        final var normalizedKind = AppStringUtils.lowerCaseToEmpty(contextKind);
        return (
            "TEAM".equals(normalizedScope) ||
            "MULTI_PROJECT".equals(normalizedScope) ||
            "multi-project".equals(normalizedKind) ||
            "team".equals(normalizedKind)
        );
    }

    private static boolean isMultiProjectMode(@Nullable String scopeMode, String contextKind) {
        final var normalizedScope = AppStringUtils.upperCaseToEmpty(scopeMode);
        final var normalizedKind = AppStringUtils.lowerCaseToEmpty(contextKind);
        return "MULTI_PROJECT".equals(normalizedScope) || "multi-project".equals(normalizedKind);
    }

    @Nullable
    private static String blankToNull(@Nullable String value) {
        return AppStringUtils.trimToNull(value);
    }

    private static String nullToEmpty(@Nullable String value) {
        return value == null ? "" : value;
    }
}
