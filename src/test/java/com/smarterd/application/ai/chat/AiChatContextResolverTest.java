package com.smarterd.application.ai.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AiChatContextResolverTest {

    private final AiChatContextResolver resolver = new AiChatContextResolver();

    @Test
    @DisplayName("10-W0-01 weak context asks for explicit scope before provider execution")
    void w0_10_W0_01_weakContextRequiresExplicitScope() {
        final var result = resolver.resolve(
            "tester",
            new AiChatContextResolver.ResolveCommand(null, null, "teams", List.of(), null, false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatContextResolver.ScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.needsConfirmation()).isNotEmpty();
    }

    @Test
    @DisplayName("10-W0-01 current route team/project scope resolves without confirmation")
    void w0_10_W0_01_currentRouteProjectScopeResolves() {
        final var result = resolver.resolve(
            "tester",
            new AiChatContextResolver.ResolveCommand(1L, 10L, "project-route", List.of(), null, false, false)
        );

        assertThat(result.status()).isEqualTo(AiChatContextResolver.ScopeStatus.RESOLVED);
        assertThat(result.teamId()).isEqualTo(1L);
        assertThat(result.projectIds()).containsExactly(10L);
    }

    @Test
    @DisplayName("10-W0-01 ambiguous or misspelled project names return confirmation candidates")
    void w0_10_W0_01_ambiguousProjectNameReturnsCandidates() {
        final var alpha = new AiChatContextResolver.ProjectCandidate(1L, 10L, "Alpha Renewal");
        final var alphaOps = new AiChatContextResolver.ProjectCandidate(1L, 11L, "Alpha Operations");

        final var result = resolver.resolve(
            "tester",
            new AiChatContextResolver.ResolveCommand(
                1L,
                null,
                "team-route",
                List.of(alpha, alphaOps),
                "Alfa",
                true,
                false
            )
        );

        assertThat(result.status()).isEqualTo(AiChatContextResolver.ScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.confirmationCandidates()).containsExactly(alpha, alphaOps);
    }

    @Test
    @DisplayName("10-W0-01 current team multi-project scope excludes cross-team projects")
    void w0_10_W0_01_currentTeamMultiProjectScopeExcludesCrossTeamProjects() {
        final var teamProject = new AiChatContextResolver.ProjectCandidate(1L, 10L, "Team Project");
        final var otherTeamProject = new AiChatContextResolver.ProjectCandidate(2L, 99L, "Other Team Project");

        final var result = resolver.resolve(
            "tester",
            new AiChatContextResolver.ResolveCommand(
                1L,
                null,
                "team-route",
                List.of(teamProject, otherTeamProject),
                null,
                true,
                true
            )
        );

        assertThat(result.status()).isEqualTo(AiChatContextResolver.ScopeStatus.RESOLVED);
        assertThat(result.projectIds()).containsExactly(10L);
    }

    @Test
    @DisplayName("10-W0-01 conflicting named project and route project requires confirmation")
    void w0_10_W0_01_conflictingRouteAndNamedProjectRequiresConfirmation() {
        final var mentioned = new AiChatContextResolver.ProjectCandidate(1L, 20L, "Named Project");

        final var result = resolver.resolve(
            "tester",
            new AiChatContextResolver.ResolveCommand(
                1L,
                10L,
                "project-route",
                List.of(mentioned),
                "Named Project",
                false,
                false
            )
        );

        assertThat(result.status()).isEqualTo(AiChatContextResolver.ScopeStatus.NEEDS_CONFIRMATION);
        assertThat(result.confirmationCandidates()).containsExactly(mentioned);
    }
}
