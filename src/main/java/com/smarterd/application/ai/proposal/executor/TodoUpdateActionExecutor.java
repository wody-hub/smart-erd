package com.smarterd.application.ai.proposal.executor;

import com.smarterd.application.ai.proposal.AiActionExecutor;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Executes approved requester-owned TODO update proposals.
 */
@Component
public class TodoUpdateActionExecutor implements AiActionExecutor {

    public static final String ACTION_TYPE = "todo.update";

    private static final Set<String> ALLOWED_FIELDS = Set.of(
        "title",
        "description",
        "status",
        "priority",
        "targetDate",
        "progressRate"
    );

    private final AiActionPayloadReader payloadReader;
    private final AiActionExecutionResultWriter resultWriter;
    private final ProjectTodoService projectTodoService;

    public TodoUpdateActionExecutor(
        AiActionPayloadReader payloadReader,
        AiActionExecutionResultWriter resultWriter,
        ProjectTodoService projectTodoService
    ) {
        this.payloadReader = payloadReader;
        this.resultWriter = resultWriter;
        this.projectTodoService = projectTodoService;
    }

    @Override
    public String actionType() {
        return ACTION_TYPE;
    }

    @Override
    public ExecutionResult execute(String loginId, AiActionProposal proposal) {
        final var payload = payloadReader.read(proposal);
        payload.requireTargetType("todo");
        payload.requireOnlyFields(ALLOWED_FIELDS);
        final var todoId = payload.requireTargetId();
        final var current = projectTodoService.getProjectTodo(
            loginId,
            proposal.getTeamId(),
            proposal.getProjectId(),
            todoId
        );
        payload.assertBeforeMatches("title", current.title());
        payload.assertBeforeMatches("description", current.description());
        payload.assertBeforeMatches("status", current.status().name());
        payload.assertBeforeMatches("priority", current.priority().name());
        payload.assertBeforeMatches("targetDate", current.targetDate());
        payload.assertBeforeMatches("progressRate", current.progressRate());

        final var result = projectTodoService.updateProjectTodo(
            loginId,
            proposal.getTeamId(),
            proposal.getProjectId(),
            todoId,
            new ProjectTodoService.UpdateProjectTodoCommand(
                payload.stringValue("title", current.title()),
                payload.hasField("description") ? payload.stringValue("description", null) : current.description(),
                payload.enumValue("status", ProjectTodoStatus.class, current.status()),
                payload.enumValue("priority", ProjectTodoPriority.class, current.priority()),
                payload.dateValue("targetDate", current.targetDate()),
                payload.intValue("progressRate", current.progressRate())
            )
        );
        return new ExecutionResult(
            resultWriter.write(ACTION_TYPE, "todo", result.id(), result.title(), "updated", "TODO updated.")
        );
    }
}
