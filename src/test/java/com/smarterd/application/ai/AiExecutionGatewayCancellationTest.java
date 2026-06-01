package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.provider.AiProviderAvailability;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.application.ai.provider.AiProviderStatus;
import com.smarterd.application.ai.validation.ActionDraftValidator;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import jakarta.validation.Validation;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AiExecutionGatewayCancellationTest {

    @Test
    void cancelInvokesProviderCancelHandle() {
        final var contextLoader = Mockito.mock(ProjectContextLoader.class);
        final var resourceValidator = Mockito.mock(SelectedResourceValidator.class);
        final var auditService = Mockito.mock(AiExecutionAuditService.class);
        final var provider = Mockito.mock(AiProvider.class);
        final var registry = new AiExecutionRegistry(Duration.ofMinutes(15), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        final var gateway = new AiExecutionGateway(
            contextLoader,
            resourceValidator,
            auditService,
            provider,
            registry,
            new ProviderOutputValidator(
                new ObjectMapper(),
                Validation.buildDefaultValidatorFactory().getValidator(),
                new ActionDraftValidator()
            )
        );
        final var owner = User.builder().loginId("owner").password("encoded").name("Owner").build();
        final var team = Team.builder().name("team").owner(owner).build();
        final var project = Project.builder().team(team).name("project").build();
        when(contextLoader.load("tester", 1L, 10L, false))
            .thenReturn(new ProjectContextLoader.ProjectContext(team, project));
        when(provider.status()).thenReturn(new AiProviderStatus("local-codex", AiProviderAvailability.AVAILABLE, null, Instant.EPOCH));
        when(provider.execute(Mockito.any())).thenReturn(AiProviderResult.answer("ok"));

        final var execution = gateway.execute(
            "tester",
            new AiExecutionGateway.ExecuteCommand(1L, 10L, "hello", "ko", null)
        );
        final var cancelled = gateway.cancelExecution("tester", execution.executionId());

        assertThat(cancelled.state()).isEqualTo(AiExecutionState.SUCCEEDED);
        verify(provider, Mockito.never()).cancel(execution.executionId());
    }
}
