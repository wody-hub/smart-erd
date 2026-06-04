package com.smarterd.application.ai.proposal.executor;

import com.smarterd.application.ai.proposal.AiActionExecutor;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Executes approved WBS work memo append proposals.
 */
@Component
public class WbsMemoAddActionExecutor implements AiActionExecutor {

    public static final String ACTION_TYPE = "wbs.memo.add";

    private final AiActionPayloadReader payloadReader;
    private final AiActionExecutionResultWriter resultWriter;
    private final WorkItemHistoryService workItemHistoryService;

    public WbsMemoAddActionExecutor(
        AiActionPayloadReader payloadReader,
        AiActionExecutionResultWriter resultWriter,
        WorkItemHistoryService workItemHistoryService
    ) {
        this.payloadReader = payloadReader;
        this.resultWriter = resultWriter;
        this.workItemHistoryService = workItemHistoryService;
    }

    @Override
    public String actionType() {
        return ACTION_TYPE;
    }

    @Override
    public ExecutionResult execute(String loginId, AiActionProposal proposal) {
        final var payload = payloadReader.read(proposal);
        payload.requireTargetType("wbs");
        payload.requireOnlyFields(Set.of());
        final var result = workItemHistoryService.addWbsComment(
            loginId,
            proposal.getTeamId(),
            proposal.getProjectId(),
            payload.requireTargetId(),
            payload.requireContent()
        );
        return new ExecutionResult(
            resultWriter.write(ACTION_TYPE, "wbs-memo", result.id(), proposal.getTargetLabel(), "created", "WBS work memo added.")
        );
    }
}
