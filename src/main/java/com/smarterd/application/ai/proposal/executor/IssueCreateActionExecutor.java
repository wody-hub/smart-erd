package com.smarterd.application.ai.proposal.executor;

import com.smarterd.application.ai.proposal.AiActionExecutor;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Executes approved low-risk project issue creation proposals.
 */
@Component
public class IssueCreateActionExecutor implements AiActionExecutor {

    public static final String ACTION_TYPE = "issue.create";

    private static final Set<String> ALLOWED_FIELDS = Set.of("title", "description", "priority", "assigneeUserId");

    private final AiActionPayloadReader payloadReader;
    private final AiActionExecutionResultWriter resultWriter;
    private final ProjectIssueService projectIssueService;

    public IssueCreateActionExecutor(
        AiActionPayloadReader payloadReader,
        AiActionExecutionResultWriter resultWriter,
        ProjectIssueService projectIssueService
    ) {
        this.payloadReader = payloadReader;
        this.resultWriter = resultWriter;
        this.projectIssueService = projectIssueService;
    }

    @Override
    public String actionType() {
        return ACTION_TYPE;
    }

    @Override
    public ExecutionResult execute(String loginId, AiActionProposal proposal) {
        final var payload = payloadReader.read(proposal);
        payload.requireTargetType("issue");
        payload.requireOnlyFields(ALLOWED_FIELDS);
        final var result = projectIssueService.createProjectIssue(
            loginId,
            proposal.getTeamId(),
            proposal.getProjectId(),
            new ProjectIssueService.CreateProjectIssueCommand(
                payload.requiredString("title"),
                payload.stringValue("description", null),
                payload.enumValue("priority", ProjectIssuePriority.class, null),
                payload.longValue("assigneeUserId", null)
            )
        );
        return new ExecutionResult(
            resultWriter.write(ACTION_TYPE, "issue", result.id(), result.title(), "created", "Issue created.")
        );
    }
}
