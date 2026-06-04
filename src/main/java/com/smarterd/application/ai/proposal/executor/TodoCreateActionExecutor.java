package com.smarterd.application.ai.proposal.executor;

import com.smarterd.application.ai.proposal.AiActionExecutor;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Executes approved requester-owned TODO creation proposals.
 */
@Component
public class TodoCreateActionExecutor implements AiActionExecutor {

    public static final String ACTION_TYPE = "todo.create";

    private static final Set<String> ALLOWED_FIELDS = Set.of(
        "title",
        "description",
        "status",
        "priority",
        "targetDate",
        "progressRate",
        "linkedWbsItemId"
    );

    private final AiActionPayloadReader payloadReader;
    private final AiActionExecutionResultWriter resultWriter;
    private final ProjectTodoService projectTodoService;

    public TodoCreateActionExecutor(
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
        final var result = projectTodoService.createProjectTodo(
            loginId,
            proposal.getTeamId(),
            proposal.getProjectId(),
            new ProjectTodoService.CreateProjectTodoCommand(
                payload.requiredString("title"),
                payload.stringValue("description", null),
                payload.enumValue("status", ProjectTodoStatus.class, null),
                payload.enumValue("priority", ProjectTodoPriority.class, null),
                payload.dateValue("targetDate", null),
                payload.hasField("progressRate") ? payload.intValue("progressRate", 0) : null,
                payload.longValue("linkedWbsItemId", null)
            )
        );
        return new ExecutionResult(
            resultWriter.write(ACTION_TYPE, "todo", result.id(), result.title(), "created", "TODO created.")
        );
    }
}
