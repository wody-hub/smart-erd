package com.smarterd.application.ai.chat;

import com.smarterd.domain.common.exception.LocalizedException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.project.service.ProjectService;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

/**
 * Resolves the project scope that may be used for an AI chat request.
 */
@Service
public class AiChatContextResolver {

    public static final int MAX_TEAM_PROJECTS = 20;

    @Nullable
    private final ProjectContextLoader projectContextLoader;

    @Nullable
    private final ProjectService projectService;

    public AiChatContextResolver() {
        this(null, null);
    }

    @Autowired
    public AiChatContextResolver(
        @Nullable ProjectContextLoader projectContextLoader,
        @Nullable ProjectService projectService
    ) {
        this.projectContextLoader = projectContextLoader;
        this.projectService = projectService;
    }

    public ResolvedContext resolve(String loginId, ResolveCommand command) {
        if (command == null) {
            return ResolvedContext.needsConfirmation(ConfirmationReason.WEAK_SCOPE);
        }
        if (isAllTeamScope(command)) {
            return ResolvedContext.denied(ConfirmationReason.UNSUPPORTED_ALL_TEAM);
        }

        final var accessibleProjects = accessibleProjects(loginId, command);
        final var mentionedProjectName = blankToNull(command.mentionedProjectName());
        if (mentionedProjectName != null) {
            final var namedResult = resolveNamedProject(loginId, command, accessibleProjects, mentionedProjectName);
            if (namedResult.status() != ScopeStatus.NEEDS_CONFIRMATION || !namedResult.confirmationCandidates().isEmpty()) {
                return namedResult;
            }
        }

        if (command.currentTeamMode() && command.multiProjectQuestion()) {
            return resolveCurrentTeamScope(command, accessibleProjects);
        }

        if (command.teamId() == null || command.projectId() == null) {
            return ResolvedContext.needsConfirmation(ConfirmationReason.WEAK_SCOPE);
        }

        final var candidateForProject = accessibleProjects
            .stream()
            .filter(project -> Objects.equals(project.projectId(), command.projectId()))
            .findFirst();
        if (candidateForProject.isPresent() && !Objects.equals(candidateForProject.get().teamId(), command.teamId())) {
            return ResolvedContext.denied(ConfirmationReason.UNAUTHORIZED_SCOPE);
        }

        return authorizeSingleProject(loginId, command.teamId(), command.projectId());
    }

    private List<ProjectCandidate> accessibleProjects(String loginId, ResolveCommand command) {
        final var requestProjects = command.accessibleProjects();
        if (!requestProjects.isEmpty() || command.teamId() == null || projectService == null) {
            return requestProjects;
        }
        try {
            return projectService
                .getProjects(loginId, command.teamId())
                .stream()
                .map(project -> new ProjectCandidate(project.teamId(), project.id(), project.name()))
                .toList();
        } catch (LocalizedException ex) {
            return List.of();
        }
    }

    private ResolvedContext resolveNamedProject(
        String loginId,
        ResolveCommand command,
        List<ProjectCandidate> accessibleProjects,
        String mentionedProjectName
    ) {
        final var teamProjects = projectsForTeam(command.teamId(), accessibleProjects);
        final var normalizedMention = normalizeProjectName(mentionedProjectName);
        if (normalizedMention.isBlank()) {
            return ResolvedContext.needsConfirmation(ConfirmationReason.WEAK_SCOPE);
        }

        final var exactMatches = teamProjects
            .stream()
            .filter(project -> normalizeProjectName(project.projectName()).equals(normalizedMention))
            .toList();
        if (exactMatches.size() > 1) {
            return ResolvedContext.needsConfirmation(ConfirmationReason.AMBIGUOUS_PROJECT, exactMatches);
        }
        if (exactMatches.size() == 1) {
            final var match = exactMatches.getFirst();
            if (command.projectId() != null && !Objects.equals(command.projectId(), match.projectId())) {
                return ResolvedContext.needsConfirmation(ConfirmationReason.CONFLICTING_PROJECT, exactMatches);
            }
            return authorizeSingleProject(loginId, match.teamId(), match.projectId());
        }

        final var containsMatches = teamProjects
            .stream()
            .filter(project -> {
                final var projectName = normalizeProjectName(project.projectName());
                return projectName.contains(normalizedMention) || normalizedMention.contains(projectName);
            })
            .toList();
        if (!containsMatches.isEmpty()) {
            return ResolvedContext.needsConfirmation(ConfirmationReason.AMBIGUOUS_PROJECT, containsMatches);
        }

        final var fuzzyMatches = teamProjects.stream().filter(project -> isFuzzyMatch(mentionedProjectName, project)).toList();
        if (!fuzzyMatches.isEmpty()) {
            return ResolvedContext.needsConfirmation(ConfirmationReason.FUZZY_PROJECT, fuzzyMatches);
        }

        return ResolvedContext.needsConfirmation(ConfirmationReason.FUZZY_PROJECT, teamProjects);
    }

    private ResolvedContext resolveCurrentTeamScope(ResolveCommand command, List<ProjectCandidate> accessibleProjects) {
        if (command.teamId() == null) {
            return ResolvedContext.needsConfirmation(ConfirmationReason.WEAK_SCOPE);
        }
        final var teamProjects = projectsForTeam(command.teamId(), accessibleProjects);
        if (teamProjects.isEmpty()) {
            return ResolvedContext.denied(ConfirmationReason.UNAUTHORIZED_SCOPE);
        }
        if (teamProjects.size() > MAX_TEAM_PROJECTS) {
            return ResolvedContext.needsConfirmation(ConfirmationReason.TOO_MANY_PROJECTS, teamProjects);
        }
        return ResolvedContext.resolved(
            command.teamId(),
            teamProjects.stream().map(ProjectCandidate::projectId).toList(),
            "team-projects"
        );
    }

    private ResolvedContext authorizeSingleProject(String loginId, Long teamId, Long projectId) {
        if (projectContextLoader == null) {
            return ResolvedContext.resolved(teamId, List.of(projectId), "project");
        }
        try {
            final var context = projectContextLoader.load(loginId, teamId, projectId, false);
            return ResolvedContext.resolved(context.team().getId(), List.of(context.project().getId()), context.project().getName());
        } catch (LocalizedException ex) {
            return ResolvedContext.denied(ConfirmationReason.UNAUTHORIZED_SCOPE);
        }
    }

    private static boolean isAllTeamScope(ResolveCommand command) {
        final var routeSource = command.routeSource() == null ? "" : command.routeSource().toLowerCase(Locale.ROOT);
        return routeSource.contains("all-team") || (command.teamId() == null && command.multiProjectQuestion());
    }

    private static List<ProjectCandidate> projectsForTeam(@Nullable Long teamId, List<ProjectCandidate> projects) {
        return projects
            .stream()
            .filter(project -> teamId == null || Objects.equals(project.teamId(), teamId))
            .toList();
    }

    private static boolean isFuzzyMatch(String mentionedProjectName, ProjectCandidate project) {
        final var normalizedMention = normalizeProjectName(mentionedProjectName);
        if (normalizedMention.isBlank()) {
            return false;
        }
        for (final var token : projectNameTokens(project.projectName())) {
            if (levenshtein(normalizedMention, normalizeProjectName(token)) <= 2) {
                return true;
            }
        }
        return levenshtein(normalizedMention, normalizeProjectName(project.projectName())) <= 2;
    }

    private static List<String> projectNameTokens(@Nullable String projectName) {
        if (projectName == null) {
            return List.of();
        }
        return List.of(projectName.split("[^\\p{Alnum}]+")).stream().filter(token -> !token.isBlank()).toList();
    }

    private static String normalizeProjectName(@Nullable String projectName) {
        if (projectName == null) {
            return "";
        }
        return projectName.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s_-]+", "");
    }

    @Nullable
    private static String blankToNull(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }

    private static int levenshtein(String left, String right) {
        final var distances = new int[left.length() + 1][right.length() + 1];
        for (var i = 0; i <= left.length(); i++) {
            distances[i][0] = i;
        }
        for (var j = 0; j <= right.length(); j++) {
            distances[0][j] = j;
        }
        for (var i = 1; i <= left.length(); i++) {
            for (var j = 1; j <= right.length(); j++) {
                final var cost = left.charAt(i - 1) == right.charAt(j - 1) ? 0 : 1;
                distances[i][j] = Math.min(
                    Math.min(distances[i - 1][j] + 1, distances[i][j - 1] + 1),
                    distances[i - 1][j - 1] + cost
                );
            }
        }
        return distances[left.length()][right.length()];
    }

    public enum ScopeStatus {
        RESOLVED,
        NEEDS_CONFIRMATION,
        DENIED,
    }

    public enum ConfirmationReason {
        WEAK_SCOPE(MessageCode.ERROR_BUSINESS_AI_CHAT_SCOPE_REQUIRED),
        AMBIGUOUS_PROJECT(MessageCode.ERROR_BUSINESS_AI_CHAT_PROJECT_AMBIGUOUS),
        FUZZY_PROJECT(MessageCode.ERROR_BUSINESS_AI_CHAT_PROJECT_FUZZY_CONFIRMATION),
        CONFLICTING_PROJECT(MessageCode.ERROR_BUSINESS_AI_CHAT_PROJECT_CONFLICTING),
        TOO_MANY_PROJECTS(MessageCode.ERROR_BUSINESS_AI_CHAT_TOO_MANY_PROJECTS),
        UNSUPPORTED_ALL_TEAM(MessageCode.ERROR_BUSINESS_AI_CHAT_ALL_TEAM_UNSUPPORTED),
        UNAUTHORIZED_SCOPE(MessageCode.ERROR_ACCESS_DENIED_AI_CHAT_SCOPE);

        private final MessageCode messageCode;

        ConfirmationReason(MessageCode messageCode) {
            this.messageCode = messageCode;
        }

        public String messageCode() {
            return messageCode.code();
        }
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
        List<String> needsConfirmation,
        ConfirmationReason confirmationReason
    ) {
        public ResolvedContext {
            projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
            confirmationCandidates =
                confirmationCandidates == null ? List.of() : List.copyOf(confirmationCandidates);
            needsConfirmation = needsConfirmation == null ? List.of() : List.copyOf(needsConfirmation);
        }

        public ResolvedContext(
            ScopeStatus status,
            Long teamId,
            List<Long> projectIds,
            String label,
            List<ProjectCandidate> confirmationCandidates,
            List<String> needsConfirmation
        ) {
            this(status, teamId, projectIds, label, confirmationCandidates, needsConfirmation, null);
        }

        public static ResolvedContext needsConfirmation(String label, String message) {
            return new ResolvedContext(
                ScopeStatus.NEEDS_CONFIRMATION,
                null,
                List.of(),
                label,
                List.of(),
                List.of(message),
                ConfirmationReason.WEAK_SCOPE
            );
        }

        public static ResolvedContext needsConfirmation(ConfirmationReason reason) {
            return needsConfirmation(reason, List.of());
        }

        public static ResolvedContext needsConfirmation(
            ConfirmationReason reason,
            List<ProjectCandidate> confirmationCandidates
        ) {
            return new ResolvedContext(
                ScopeStatus.NEEDS_CONFIRMATION,
                null,
                List.of(),
                reason.name(),
                confirmationCandidates,
                List.of(reason.messageCode()),
                reason
            );
        }

        public static ResolvedContext denied(ConfirmationReason reason) {
            return new ResolvedContext(
                ScopeStatus.DENIED,
                null,
                List.of(),
                reason.name(),
                List.of(),
                List.of(reason.messageCode()),
                reason
            );
        }

        public static ResolvedContext resolved(Long teamId, List<Long> projectIds, String label) {
            return new ResolvedContext(ScopeStatus.RESOLVED, teamId, projectIds, label, List.of(), List.of(), null);
        }

        public boolean isResolved() {
            return status == ScopeStatus.RESOLVED;
        }
    }
}
