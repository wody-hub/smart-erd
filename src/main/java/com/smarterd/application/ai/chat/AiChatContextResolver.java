package com.smarterd.application.ai.chat;

import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Resolves the project scope that may be used for an AI chat request.
 */
@Component
public class AiChatContextResolver {

    public ResolvedContext resolve(String loginId, ResolveCommand command) {
        if (command == null || command.teamId() == null || command.projectId() == null) {
            return ResolvedContext.needsConfirmation("scope-required", "AI chat requires an explicit project scope.");
        }
        return ResolvedContext.needsConfirmation("scope-confirmation", "AI chat scope resolution is not implemented yet.");
    }

    public enum ScopeStatus {
        RESOLVED,
        NEEDS_CONFIRMATION,
        DENIED,
    }

    public record ResolveCommand(
        Long teamId,
        Long projectId,
        String routeSource,
        List<ProjectCandidate> accessibleProjects,
        String mentionedProjectName,
        boolean currentTeamMode,
        boolean multiProjectQuestion
    ) {
        public ResolveCommand {
            accessibleProjects = accessibleProjects == null ? List.of() : List.copyOf(accessibleProjects);
        }
    }

    public record ProjectCandidate(Long teamId, Long projectId, String projectName) {}

    public record ResolvedContext(
        ScopeStatus status,
        Long teamId,
        List<Long> projectIds,
        String label,
        List<ProjectCandidate> confirmationCandidates,
        List<String> needsConfirmation
    ) {
        public ResolvedContext {
            projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
            confirmationCandidates =
                confirmationCandidates == null ? List.of() : List.copyOf(confirmationCandidates);
            needsConfirmation = needsConfirmation == null ? List.of() : List.copyOf(needsConfirmation);
        }

        public static ResolvedContext needsConfirmation(String label, String message) {
            return new ResolvedContext(ScopeStatus.NEEDS_CONFIRMATION, null, List.of(), label, List.of(), List.of(message));
        }

        public boolean isResolved() {
            return status == ScopeStatus.RESOLVED;
        }
    }
}
