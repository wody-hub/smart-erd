package com.smarterd.application.ai.chat;

import com.smarterd.domain.common.exception.LocalizedException;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.project.service.ProjectService;
import com.smarterd.utils.AppStringUtils;
import java.util.List;
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

    private final ProjectContextLoader projectContextLoader;

    @Nullable
    private final ProjectService projectService;

    @Autowired
    public AiChatContextResolver(ProjectContextLoader projectContextLoader, @Nullable ProjectService projectService) {
        this.projectContextLoader = projectContextLoader;
        this.projectService = projectService;
    }

    /**
     * Resolves and authorizes the chat project scope.
     *
     * @param loginId requester login id
     * @param command scope resolution command
     * @return resolved, denied, or confirmation-required scope
     */
    public AiChatResolvedContext resolve(String loginId, AiChatResolveCommand command) {
        if (command == null) {
            return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.WEAK_SCOPE);
        }
        if (isAllTeamScope(command)) {
            return AiChatResolvedContext.denied(AiChatConfirmationReason.UNSUPPORTED_ALL_TEAM);
        }

        final var accessibleProjects = accessibleProjects(loginId, command);
        final var mentionedProjectName = blankToNull(command.mentionedProjectName());
        if (mentionedProjectName != null) {
            final var namedResult = resolveNamedProject(loginId, command, accessibleProjects, mentionedProjectName);
            if (
                namedResult.status() != AiChatScopeStatus.NEEDS_CONFIRMATION ||
                !namedResult.confirmationCandidates().isEmpty()
            ) {
                return namedResult;
            }
        }

        if (command.currentTeamMode() && command.multiProjectQuestion()) {
            return resolveCurrentTeamScope(command, accessibleProjects);
        }

        if (command.teamId() == null || command.projectId() == null) {
            return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.WEAK_SCOPE);
        }

        final var candidateForProject = accessibleProjects
            .stream()
            .filter((project) -> Objects.equals(project.projectId(), command.projectId()))
            .findFirst();
        if (candidateForProject.isPresent() && !Objects.equals(candidateForProject.get().teamId(), command.teamId())) {
            return AiChatResolvedContext.denied(AiChatConfirmationReason.UNAUTHORIZED_SCOPE);
        }

        return authorizeSingleProject(loginId, command.teamId(), command.projectId());
    }

    /**
     * Loads accessible project candidates for the requested team when the command did not provide them.
     *
     * @param loginId requester login id
     * @param command scope resolution command
     * @return accessible project candidates
     */
    private List<AiChatProjectCandidate> accessibleProjects(String loginId, AiChatResolveCommand command) {
        final var requestProjects = command.accessibleProjects();
        if (!requestProjects.isEmpty() || command.teamId() == null || projectService == null) {
            return requestProjects;
        }
        try {
            return projectService
                .getProjects(loginId, command.teamId())
                .stream()
                .map((project) -> new AiChatProjectCandidate(project.teamId(), project.id(), project.name()))
                .toList();
        } catch (LocalizedException ex) {
            return List.of();
        }
    }

    /**
     * Resolves a mentioned project name against accessible projects.
     *
     * @param loginId requester login id
     * @param command scope resolution command
     * @param accessibleProjects projects visible to the requester
     * @param mentionedProjectName project name from the request
     * @return resolved or confirmation-required scope
     */
    private AiChatResolvedContext resolveNamedProject(
        String loginId,
        AiChatResolveCommand command,
        List<AiChatProjectCandidate> accessibleProjects,
        String mentionedProjectName
    ) {
        final var teamProjects = projectsForTeam(command.teamId(), accessibleProjects);
        final var normalizedMention = normalizeProjectName(mentionedProjectName);
        if (AppStringUtils.isBlank(normalizedMention)) {
            return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.WEAK_SCOPE);
        }

        final var exactMatches = teamProjects
            .stream()
            .filter((project) -> normalizeProjectName(project.projectName()).equals(normalizedMention))
            .toList();
        if (exactMatches.size() > 1) {
            return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.AMBIGUOUS_PROJECT, exactMatches);
        }
        if (exactMatches.size() == 1) {
            final var match = exactMatches.getFirst();
            if (command.projectId() != null && !Objects.equals(command.projectId(), match.projectId())) {
                return AiChatResolvedContext.needsConfirmation(
                    AiChatConfirmationReason.CONFLICTING_PROJECT,
                    exactMatches
                );
            }
            return authorizeSingleProject(loginId, match.teamId(), match.projectId());
        }

        final var containsMatches = teamProjects
            .stream()
            .filter((project) -> {
                final var projectName = normalizeProjectName(project.projectName());
                return projectName.contains(normalizedMention) || normalizedMention.contains(projectName);
            })
            .toList();
        if (!containsMatches.isEmpty()) {
            return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.AMBIGUOUS_PROJECT, containsMatches);
        }

        final var fuzzyMatches = teamProjects
            .stream()
            .filter((project) -> isFuzzyMatch(mentionedProjectName, project))
            .toList();
        if (!fuzzyMatches.isEmpty()) {
            return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.FUZZY_PROJECT, fuzzyMatches);
        }

        return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.FUZZY_PROJECT, teamProjects);
    }

    /**
     * Resolves a current-team multi-project scope.
     *
     * @param command scope resolution command
     * @param accessibleProjects projects visible to the requester
     * @return resolved, denied, or confirmation-required scope
     */
    private AiChatResolvedContext resolveCurrentTeamScope(
        AiChatResolveCommand command,
        List<AiChatProjectCandidate> accessibleProjects
    ) {
        if (command.teamId() == null) {
            return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.WEAK_SCOPE);
        }
        final var teamProjects = projectsForTeam(command.teamId(), accessibleProjects);
        if (teamProjects.isEmpty()) {
            return AiChatResolvedContext.denied(AiChatConfirmationReason.UNAUTHORIZED_SCOPE);
        }
        if (teamProjects.size() > MAX_TEAM_PROJECTS) {
            return AiChatResolvedContext.needsConfirmation(AiChatConfirmationReason.TOO_MANY_PROJECTS, teamProjects);
        }
        return AiChatResolvedContext.resolved(
            command.teamId(),
            teamProjects.stream().map(AiChatProjectCandidate::projectId).toList(),
            "team-projects"
        );
    }

    /**
     * Authorizes one team/project pair and maps the result into chat scope.
     *
     * @param loginId requester login id
     * @param teamId team id
     * @param projectId project id
     * @return resolved or denied scope
     */
    private AiChatResolvedContext authorizeSingleProject(String loginId, Long teamId, Long projectId) {
        try {
            final var context = projectContextLoader.load(loginId, teamId, projectId, false);
            return AiChatResolvedContext.resolved(
                context.team().getId(),
                List.of(context.project().getId()),
                context.project().getName()
            );
        } catch (LocalizedException ex) {
            return AiChatResolvedContext.denied(AiChatConfirmationReason.UNAUTHORIZED_SCOPE);
        }
    }

    /**
     * Checks whether the request is asking for an unsupported all-team scope.
     *
     * @param command scope resolution command
     * @return true when all-team scope is requested
     */
    private static boolean isAllTeamScope(AiChatResolveCommand command) {
        final var routeSource = AppStringUtils.lowerCaseToEmpty(command.routeSource());
        return routeSource.contains("all-team") || (command.teamId() == null && command.multiProjectQuestion());
    }

    /**
     * Filters project candidates to the requested team.
     *
     * @param teamId team id, or null for all candidates
     * @param projects candidate projects
     * @return candidates in the requested team
     */
    private static List<AiChatProjectCandidate> projectsForTeam(
        @Nullable Long teamId,
        List<AiChatProjectCandidate> projects
    ) {
        return projects
            .stream()
            .filter((project) -> teamId == null || Objects.equals(project.teamId(), teamId))
            .toList();
    }

    /**
     * Checks whether a mentioned project name is close enough to a candidate name.
     *
     * @param mentionedProjectName project name from the request
     * @param project candidate project
     * @return true when the candidate should be offered for confirmation
     */
    private static boolean isFuzzyMatch(String mentionedProjectName, AiChatProjectCandidate project) {
        final var normalizedMention = normalizeProjectName(mentionedProjectName);
        if (AppStringUtils.isBlank(normalizedMention)) {
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
        return List.of(projectName.split("[^\\p{Alnum}]+")).stream().filter(AppStringUtils::isNotBlank).toList();
    }

    private static String normalizeProjectName(@Nullable String projectName) {
        return AppStringUtils.lowerTrimToEmpty(projectName).replaceAll("[\\s_-]+", "");
    }

    @Nullable
    private static String blankToNull(@Nullable String value) {
        return AppStringUtils.trimToNull(value);
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
}
