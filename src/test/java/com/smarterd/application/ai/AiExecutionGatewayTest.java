package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class AiExecutionGatewayTest {

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private SelectedResourceValidator selectedResourceValidator;

    @Mock
    private AiProviderExecutionRunner providerExecutionRunner;

    private AiExecutionGateway gateway;

    @BeforeEach
    void setUp() {
        gateway = new AiExecutionGateway(projectContextLoader, selectedResourceValidator, providerExecutionRunner);
    }

    @Test
    void executeDelegatesProviderRunOnlyAfterAuthorizationPreflight() {
        final var owner = User.builder().loginId("owner").password("encoded").name("Owner").build();
        final var team = Team.builder().name("team").owner(owner).build();
        final var project = Project.builder().team(team).name("project").build();
        when(projectContextLoader.load("tester", 1L, 10L, false)).thenReturn(
            new ProjectContextLoader.ProjectContext(team, project)
        );
        when(
            providerExecutionRunner.execute(
                org.mockito.ArgumentMatchers.eq("tester"),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(
            new AiExecutionGateway.AiExecutionView(
                "exec-1",
                "noop",
                AiExecutionGateway.PROMPT_VERSION,
                AiExecutionState.SUCCEEDED,
                Instant.EPOCH,
                Instant.EPOCH,
                Instant.EPOCH,
                0L,
                "answer",
                java.util.List.of(),
                null
            )
        );

        final var result = gateway.execute(
            "tester",
            new AiExecutionGateway.ExecuteCommand(1L, 10L, "What can you do?", "ko", null)
        );

        final var commandCaptor = ArgumentCaptor.forClass(AiProviderExecutionRunner.RunCommand.class);
        assertThat(result.executionId()).isEqualTo("exec-1");
        assertThat(result.state()).isEqualTo(AiExecutionState.SUCCEEDED);
        verify(projectContextLoader).load("tester", 1L, 10L, false);
        verify(providerExecutionRunner).execute(org.mockito.ArgumentMatchers.eq("tester"), commandCaptor.capture());
        assertThat(commandCaptor.getValue().teamId()).isEqualTo(1L);
        assertThat(commandCaptor.getValue().projectId()).isEqualTo(10L);
        assertThat(commandCaptor.getValue().promptVersion()).isEqualTo(AiExecutionGateway.PROMPT_VERSION);
        assertThat(commandCaptor.getValue().providerContext())
            .containsEntry("teamId", 1L)
            .containsEntry("projectId", 10L)
            .containsEntry("locale", "ko")
            .doesNotContainKey("loginId");
        assertThat(commandCaptor.getValue().providerContext().values()).doesNotContain("tester");
    }

    @Test
    void executeDoesNotInvokeRunnerWhenAuthorizationFails() {
        when(projectContextLoader.load("tester", 1L, 10L, false)).thenThrow(
            new com.smarterd.domain.common.exception.DomainAccessDeniedException("error.access-denied.not-member")
        );

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            gateway.execute("tester", new AiExecutionGateway.ExecuteCommand(1L, 10L, "hello", "ko", null))
        ).isInstanceOf(com.smarterd.domain.common.exception.DomainAccessDeniedException.class);

        verify(providerExecutionRunner, never()).execute(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void executeIsNotTransactionalSoProviderRunStaysOutsideDatabaseTransaction() throws NoSuchMethodException {
        final var executeMethod = AiExecutionGateway.class.getMethod(
            "execute",
            String.class,
            AiExecutionGateway.ExecuteCommand.class
        );

        assertThat(executeMethod.getAnnotation(Transactional.class)).isNull();
    }
}
