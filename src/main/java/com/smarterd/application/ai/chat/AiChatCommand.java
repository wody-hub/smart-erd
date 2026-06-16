package com.smarterd.application.ai.chat;

import com.smarterd.utils.AppStringUtils;
import java.util.List;

public record AiChatCommand(
    Long teamId,
    Long projectId,
    String userMessage,
    String locale,
    String routeSource,
    String mentionedProjectName,
    String scopeMode,
    boolean currentTeamMode,
    boolean multiProjectQuestion
) {
    public AiChatCommand(Long teamId, Long projectId, String userMessage, String locale, String routeSource) {
        this(teamId, projectId, userMessage, locale, routeSource, null, null, false, false);
    }

    AiChatResolveCommand toResolveCommand() {
        return new AiChatResolveCommand(
            teamId,
            projectId,
            routeSource,
            List.of(),
            mentionedProjectName,
            currentTeamMode,
            multiProjectQuestion
        );
    }

    AiReadContextService.ReadCommand toReadCommand(AiChatResolvedContext context) {
        return new AiReadContextService.ReadCommand(
            context.teamId(),
            context.projectIds(),
            java.util.Set.of(),
            memberTodoSummaryRequested(),
            null,
            userMessage
        );
    }

    /**
     * Detects when the question asks for member or team TODO aggregation.
     *
     * @return true when member TODO aggregation is requested
     */
    private boolean memberTodoSummaryRequested() {
        final var text = AppStringUtils.lowerCaseToEmpty(userMessage);
        return (
            text.contains("member todo") || text.contains("team todo") || text.contains("멤버") || text.contains("팀원")
        );
    }
}
