package com.smarterd.application.ai.chat;

import java.util.List;

public record AiChatResolveCommand(
    Long teamId,
    Long projectId,
    String routeSource,
    List<AiChatProjectCandidate> accessibleProjects,
    String mentionedProjectName,
    boolean currentTeamMode,
    boolean multiProjectQuestion
) {
    /**
     * Normalizes nullable project candidates into an immutable empty-safe list.
     */
    public AiChatResolveCommand {
        accessibleProjects = accessibleProjects == null ? List.of() : List.copyOf(accessibleProjects);
    }
}
