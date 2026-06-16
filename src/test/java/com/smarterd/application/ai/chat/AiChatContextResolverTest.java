package com.smarterd.application.ai.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AiChatContextResolverTest {

    @Mock
    private ProjectContextLoader projectContextLoader;

    private AiChatContextResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new AiChatContextResolver(projectContextLoader, null);
    }

    @Test
    @DisplayName("10-W0-01 weak context asks for explicit scope before provider execution")
    void w0_10_W0_01_weakContextRequiresExplicitScope() {
        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(null, null, "teams", List.of(), null, false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.needsConfirmation()).isNotEmpty();
        assertThat(result.confirmationReason()).isEqualTo(AiChatConfirmationReason.WEAK_SCOPE);
    }

    @Test
    @DisplayName("10-W0-01 current route team/project scope resolves without confirmation")
    void w0_10_W0_01_currentRouteProjectScopeResolves() {
        when(projectContextLoader.load("tester", 1L, 10L, false)).thenReturn(
            projectContext(1L, 10L, "Authorized Project")
        );

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, 10L, "project-route", List.of(), null, false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.RESOLVED);
        assertThat(result.teamId()).isEqualTo(1L);
        assertThat(result.projectIds()).containsExactly(10L);
        assertThat(result.label()).isEqualTo("Authorized Project");
        verify(projectContextLoader).load("tester", 1L, 10L, false);
    }

    @Test
    @DisplayName("10-W0-01 ambiguous or misspelled project names return confirmation candidates")
    void w0_10_W0_01_ambiguousProjectNameReturnsCandidates() {
        final var alpha = new AiChatProjectCandidate(1L, 10L, "Alpha Renewal");
        final var alphaOps = new AiChatProjectCandidate(1L, 11L, "Alpha Operations");

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, null, "team-route", List.of(alpha, alphaOps), "Alfa", true, false)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.confirmationCandidates()).containsExactly(alpha, alphaOps);
        assertThat(result.confirmationReason()).isEqualTo(AiChatConfirmationReason.FUZZY_PROJECT);
    }

    @Test
    @DisplayName("10-02 named project resolves only on normalized exact match")
    void namedProjectResolvesOnlyOnNormalizedExactMatch() {
        final var target = new AiChatProjectCandidate(1L, 10L, "Alpha_Renewal");
        final var other = new AiChatProjectCandidate(1L, 11L, "Alpha Operations");
        when(projectContextLoader.load("tester", 1L, 10L, false)).thenReturn(projectContext(1L, 10L, "Alpha_Renewal"));

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, null, "team-route", List.of(target, other), " alpha-renewal ", false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.RESOLVED);
        assertThat(result.projectIds()).containsExactly(10L);
    }

    @Test
    @DisplayName("10-09 single-project scope returns DENIED when ProjectContextLoader rejects access")
    void singleProjectScopeReturnsDeniedWhenProjectContextLoaderRejectsAccess() {
        when(projectContextLoader.load("tester", 1L, 10L, false)).thenThrow(
            new DomainAccessDeniedException("error.access-denied.not-member")
        );

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, 10L, "project-route", List.of(), null, false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.DENIED);
        assertThat(result.projectIds()).isEmpty();
        assertThat(result.confirmationReason()).isEqualTo(AiChatConfirmationReason.UNAUTHORIZED_SCOPE);
        verify(projectContextLoader).load("tester", 1L, 10L, false);
    }

    @Test
    @DisplayName("10-02 contains-only project names require confirmation")
    void containsOnlyProjectNameRequiresConfirmation() {
        final var candidate = new AiChatProjectCandidate(1L, 10L, "Alpha Renewal");

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, null, "team-route", List.of(candidate), "Alpha", false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.confirmationCandidates()).containsExactly(candidate);
        assertThat(result.confirmationReason()).isEqualTo(AiChatConfirmationReason.AMBIGUOUS_PROJECT);
    }

    @Test
    @DisplayName("10-02 duplicate normalized exact project names require confirmation")
    void duplicateNormalizedExactProjectNamesRequireConfirmation() {
        final var first = new AiChatProjectCandidate(1L, 10L, "Alpha Renewal");
        final var second = new AiChatProjectCandidate(1L, 11L, "alpha_renewal");

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, null, "team-route", List.of(first, second), "alpha-renewal", false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.confirmationCandidates()).containsExactly(first, second);
        assertThat(result.confirmationReason()).isEqualTo(AiChatConfirmationReason.AMBIGUOUS_PROJECT);
    }

    @Test
    @DisplayName("10-W0-01 current team multi-project scope excludes cross-team projects")
    void w0_10_W0_01_currentTeamMultiProjectScopeExcludesCrossTeamProjects() {
        final var teamProject = new AiChatProjectCandidate(1L, 10L, "Team Project");
        final var otherTeamProject = new AiChatProjectCandidate(2L, 99L, "Other Team Project");

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, null, "team-route", List.of(teamProject, otherTeamProject), null, true, true)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.RESOLVED);
        assertThat(result.projectIds()).containsExactly(10L);
    }

    @Test
    @DisplayName("10-02 current team fanout over 20 projects requires narrowing")
    void currentTeamFanoutOverTwentyProjectsRequiresNarrowScopeConfirmation() {
        final var projects = LongStream.rangeClosed(1, 21)
            .mapToObj((id) -> new AiChatProjectCandidate(1L, id, "Project " + id))
            .toList();

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, null, "team-route", projects, null, true, true)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.projectIds()).isEmpty();
        assertThat(result.confirmationReason()).isEqualTo(AiChatConfirmationReason.TOO_MANY_PROJECTS);
    }

    @Test
    @DisplayName("10-W0-01 conflicting named project and route project requires confirmation")
    void w0_10_W0_01_conflictingRouteAndNamedProjectRequiresConfirmation() {
        final var mentioned = new AiChatProjectCandidate(1L, 20L, "Named Project");

        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(1L, 10L, "project-route", List.of(mentioned), "Named Project", false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.confirmationCandidates()).containsExactly(mentioned);
        assertThat(result.confirmationReason()).isEqualTo(AiChatConfirmationReason.CONFLICTING_PROJECT);
    }

    @Test
    @DisplayName("10-02 all-team scope is rejected before read context")
    void allTeamScopeIsDeniedBeforeReadContext() {
        final var result = resolver.resolve(
            "tester",
            new AiChatResolveCommand(null, null, "all-teams", List.of(), null, false, true)
        );

        assertThat(result.status()).isEqualTo(AiChatScopeStatus.DENIED);
        assertThat(result.confirmationReason()).isEqualTo(AiChatConfirmationReason.UNSUPPORTED_ALL_TEAM);
    }

    private ProjectContextLoader.ProjectContext projectContext(Long teamId, Long projectId, String projectName) {
        final var owner = User.builder().loginId("owner").password("encoded").name("Owner").build();
        final var team = Team.builder().name("Team").owner(owner).build();
        ReflectionTestUtils.setField(team, "id", teamId);
        final var project = Project.builder().team(team).name(projectName).description("desc").build();
        ReflectionTestUtils.setField(project, "id", projectId);
        return new ProjectContextLoader.ProjectContext(team, project);
    }
}
