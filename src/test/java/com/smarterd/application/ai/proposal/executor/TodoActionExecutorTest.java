package com.smarterd.application.ai.proposal.executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TodoActionExecutorTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Mock
    private ProjectTodoService projectTodoService;

    private TodoCreateActionExecutor createExecutor;
    private TodoUpdateActionExecutor updateExecutor;

    @BeforeEach
    void setUp() {
        final var payloadReader = new AiActionPayloadReader(objectMapper);
        final var resultWriter = new AiActionExecutionResultWriter(objectMapper);
        createExecutor = new TodoCreateActionExecutor(payloadReader, resultWriter, projectTodoService);
        updateExecutor = new TodoUpdateActionExecutor(payloadReader, resultWriter, projectTodoService);
    }

    @Test
    void todoCreate_callsProjectTodoServiceWithoutOwnerPayload() throws Exception {
        when(projectTodoService.createProjectTodo(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.any()))
            .thenReturn(todo(55L, "My TODO", ProjectTodoStatus.TODO, ProjectTodoPriority.HIGH, 20));

        final var result = createExecutor.execute(
            "tester",
            proposal(
                TodoCreateActionExecutor.ACTION_TYPE,
                "todo",
                null,
                Map.of(
                    "targetType",
                    "todo",
                    "fields",
                    List.of(
                        Map.of("name", "title", "afterValue", "My TODO"),
                        Map.of("name", "priority", "afterValue", "HIGH"),
                        Map.of("name", "progressRate", "afterValue", "20")
                    )
                )
            )
        );

        final var command = ArgumentCaptor.forClass(ProjectTodoService.CreateProjectTodoCommand.class);
        verify(projectTodoService).createProjectTodo(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.eq(10L), command.capture());
        assertThat(command.getValue().title()).isEqualTo("My TODO");
        assertThat(command.getValue().priority()).isEqualTo(ProjectTodoPriority.HIGH);
        assertThat(command.getValue().progressRate()).isEqualTo(20);
        assertThat(result.resultJson()).contains("\"resourceId\":\"55\"").contains("TODO created.");
    }

    @Test
    void todoUpdate_rejectsStaleBeforeValueWithoutMutation() throws Exception {
        when(projectTodoService.getProjectTodo("tester", 1L, 10L, 55L))
            .thenReturn(todo(55L, "Current", ProjectTodoStatus.TODO, ProjectTodoPriority.MEDIUM, 0));

        final var proposal = proposal(
            TodoUpdateActionExecutor.ACTION_TYPE,
            "todo",
            "55",
            Map.of(
                "targetType",
                "todo",
                "targetId",
                "55",
                "fields",
                List.of(Map.of("name", "status", "beforeValue", "DONE", "afterValue", "TODO"))
            )
        );

        assertThatThrownBy(() -> updateExecutor.execute("tester", proposal)).isInstanceOf(IllegalArgumentException.class);
        verify(projectTodoService, never())
            .updateProjectTodo(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void todoCreate_rejectsOwnerFieldWithoutMutation() throws Exception {
        final var proposal = proposal(
            TodoCreateActionExecutor.ACTION_TYPE,
            "todo",
            null,
            Map.of("targetType", "todo", "fields", List.of(Map.of("name", "ownerUserId", "afterValue", "99")))
        );

        assertThatThrownBy(() -> createExecutor.execute("tester", proposal)).isInstanceOf(IllegalArgumentException.class);
        verify(projectTodoService, never())
            .createProjectTodo(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    private ProjectTodoService.ProjectTodoResult todo(
        Long id,
        String title,
        ProjectTodoStatus status,
        ProjectTodoPriority priority,
        int progressRate
    ) {
        return new ProjectTodoService.ProjectTodoResult(
            id,
            title,
            null,
            status,
            priority,
            LocalDate.of(2026, 6, 30),
            progressRate,
            null,
            null,
            Instant.EPOCH,
            Instant.EPOCH
        );
    }

    private AiActionProposal proposal(String actionType, String targetType, String targetId, Map<String, Object> payload)
        throws Exception {
        return new AiActionProposal(
            "proposal-1",
            "exec-1",
            "noop",
            "provider-response-v1",
            actionType,
            AiActionRiskLevel.LOW,
            1L,
            10L,
            targetType,
            targetId,
            "Target",
            "Title",
            "Summary",
            "tester",
            Instant.now().plusSeconds(900),
            objectMapper.writeValueAsString(payload),
            "{}"
        );
    }
}
