package com.smarterd.api.ai.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.smarterd.application.ai.chat.AiChatExecutionService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.lang.Nullable;

public record AiChatRequest(
    @JsonAlias("userMessage") @NotBlank(message = "{validation.not-blank.ai-chat-message}") @Size(
        max = 4000,
        message = "{validation.size.ai-chat-message}"
    ) String message,
    Long teamId,
    Long projectId,
    @Size(max = 120) String projectName,
    @Size(max = 40) String scopeMode,
    @Size(max = 20) String locale,
    @Valid AiChatContextRequest context,
    @Valid AiChatContextRequest selectedContext
) {
    public AiChatExecutionService.ChatCommand toCommand() {
        final var effectiveContext = selectedContext == null ? context : selectedContext;
        final var effectiveTeamId = teamId == null && effectiveContext != null ? effectiveContext.teamId() : teamId;
        final var effectiveProjectId = projectId == null && effectiveContext != null ? effectiveContext.projectId() : projectId;
        final var effectiveProjectName = blankToNull(projectName) == null && effectiveContext != null
            ? effectiveContext.projectName()
            : projectName;
        final var effectiveScopeMode = blankToNull(scopeMode);
        final var contextKind = effectiveContext == null ? "" : nullToEmpty(effectiveContext.kind());
        return new AiChatExecutionService.ChatCommand(
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
        final var normalizedScope = nullToEmpty(scopeMode).toUpperCase(java.util.Locale.ROOT);
        final var normalizedKind = contextKind.toLowerCase(java.util.Locale.ROOT);
        return (
            "TEAM".equals(normalizedScope) ||
            "MULTI_PROJECT".equals(normalizedScope) ||
            "multi-project".equals(normalizedKind) ||
            "team".equals(normalizedKind)
        );
    }

    private static boolean isMultiProjectMode(@Nullable String scopeMode, String contextKind) {
        final var normalizedScope = nullToEmpty(scopeMode).toUpperCase(java.util.Locale.ROOT);
        final var normalizedKind = contextKind.toLowerCase(java.util.Locale.ROOT);
        return "MULTI_PROJECT".equals(normalizedScope) || "multi-project".equals(normalizedKind);
    }

    @Nullable
    private static String blankToNull(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }

    private static String nullToEmpty(@Nullable String value) {
        return value == null ? "" : value;
    }

    public record AiChatContextRequest(
        @Size(max = 40) String kind,
        Long teamId,
        @Size(max = 120) String teamName,
        Long projectId,
        @Size(max = 120) String projectName,
        @Size(max = 40) String source,
        @Size(max = 40) String capturedAt,
        @Size(max = 40) String confidence,
        Boolean scopeRequired
    ) {}
}
