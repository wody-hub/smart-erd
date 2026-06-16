package com.smarterd.application.ai.proposal;

import com.smarterd.application.ai.provider.AiActionDraft;
import java.util.List;

public record AiActionProposalCreateCommand(
    String executionId,
    String provider,
    String promptVersion,
    Long teamId,
    Long projectId,
    String requestedBy,
    List<AiActionDraft> actions
) {
    public AiActionProposalCreateCommand {
        actions = actions == null ? List.of() : List.copyOf(actions);
    }
}
