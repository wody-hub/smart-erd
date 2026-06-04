package com.smarterd.application.ai.proposal.executor;

import com.smarterd.application.ai.proposal.AiActionExecutor;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Executes approved low-risk project issue update proposals.
 */
@Component
public class IssueUpdateActionExecutor implements AiActionExecutor {

    public static final String ACTION_TYPE = "issue.update";

    private static final Set<String> ALLOWED_FIELDS = Set.of("title", "description", "priority", "assigneeUserId");

    private final AiActionPayloadReader payloadReader;
    private final AiActionExecutionResultWriter resultWriter;
    private final ProjectIssueService projectIssueService;

    public IssueUpdateActionExecutor(
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
        final var issueId = payload.requireTargetId();
        final var current = projectIssueService.getProjectIssue(loginId, proposal.getTeamId(), proposal.getProjectId(), issueId);
        payload.assertBeforeMatches("title", current.title());
        payload.assertBeforeMatches("description", current.description());
        payload.assertBeforeMatches("priority", current.priority().name());
        payload.assertBeforeMatches("assigneeUserId", current.assigneeUserId());

        final var result = projectIssueService.updateProjectIssue(
            loginId,
            proposal.getTeamId(),
            proposal.getProjectId(),
            issueId,
            new ProjectIssueService.UpdateProjectIssueCommand(
                payload.stringValue("title", current.title()),
                payload.hasField("description") ? payload.stringValue("description", null) : current.description(),
                payload.enumValue("priority", ProjectIssuePriority.class, current.priority()),
                payload.longValue("assigneeUserId", current.assigneeUserId())
            )
        );
        return new ExecutionResult(
            resultWriter.write(ACTION_TYPE, "issue", result.id(), result.title(), "updated", "Issue updated.")
        );
    }
}
