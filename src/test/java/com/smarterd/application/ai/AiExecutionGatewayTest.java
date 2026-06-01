package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.application.ai.provider.AiProviderStatus;
import com.smarterd.application.ai.provider.AiProviderAvailability;
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
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiExecutionGatewayTest {

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private SelectedResourceValidator selectedResourceValidator;

    @Mock
    private AiExecutionAuditService auditService;

    @Mock
    private AiProvider aiProvider;

    private AiExecutionGateway gateway;

    @BeforeEach
    void setUp() {
        final var validator = new ProviderOutputValidator(
            new ObjectMapper(),
            Validation.buildDefaultValidatorFactory().getValidator(),
            new ActionDraftValidator()
        );
        final var registry = new AiExecutionRegistry(Duration.ofMinutes(15), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        gateway = new AiExecutionGateway(
            projectContextLoader,
            selectedResourceValidator,
            auditService,
            aiProvider,
            registry,
            validator
        );
    }

    @Test
    void executeRunsProviderOnlyAfterAuthorizationPreflight() {
        final var owner = User.builder().loginId("owner").password("encoded").name("Owner").build();
        final var team = Team.builder().name("team").owner(owner).build();
        final var project = Project.builder().team(team).name("project").build();
        when(projectContextLoader.load("tester", 1L, 10L, false))
            .thenReturn(new ProjectContextLoader.ProjectContext(team, project));
        when(aiProvider.status()).thenReturn(new AiProviderStatus("noop", AiProviderAvailability.NOT_CONFIGURED, null, Instant.EPOCH));
        when(aiProvider.execute(org.mockito.ArgumentMatchers.any()))
            .thenReturn(AiProviderResult.failed(new AiProviderError("NOT_CONFIGURED", "Not configured", "No provider", false)));

        final var result = gateway.execute(
            "tester",
            new AiExecutionGateway.ExecuteCommand(1L, 10L, "What can you do?", "ko", null)
        );

        assertThat(result.executionId()).isNotBlank();
        assertThat(result.state()).isEqualTo(AiExecutionState.FAILED);
        verify(projectContextLoader).load("tester", 1L, 10L, false);
        verify(aiProvider).execute(org.mockito.ArgumentMatchers.any());
        verify(auditService).record(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void executeDoesNotInvokeProviderWhenAuthorizationFails() {
        when(projectContextLoader.load("tester", 1L, 10L, false))
            .thenThrow(new com.smarterd.domain.common.exception.DomainAccessDeniedException("error.access-denied.not-member"));

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            gateway.execute("tester", new AiExecutionGateway.ExecuteCommand(1L, 10L, "hello", "ko", null))
        ).isInstanceOf(com.smarterd.domain.common.exception.DomainAccessDeniedException.class);

        verify(aiProvider, never()).execute(org.mockito.ArgumentMatchers.any());
        verify(auditService, never()).record(org.mockito.ArgumentMatchers.any());
    }
}
