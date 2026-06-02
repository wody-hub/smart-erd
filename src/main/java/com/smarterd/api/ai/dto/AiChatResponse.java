package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiChatExecutionService;
import java.util.List;

public record AiChatResponse(
    String status,
    String conclusion,
    String interpretation,
    List<String> confirmedFacts,
    List<String> needsConfirmation,
    List<AiChatSourceChipResponse> sourceChips,
    List<AiConfirmationCandidateResponse> confirmationCandidates,
    String error
) {
    public static AiChatResponse from(AiChatExecutionService.AiChatView view) {
        return new AiChatResponse(
            view.status(),
            view.conclusion(),
            view.interpretation(),
            view.confirmedFacts(),
            view.needsConfirmation(),
            view.sourceChips().stream().map(AiChatSourceChipResponse::from).toList(),
            view
                .confirmationCandidates()
                .stream()
                .map((candidate) ->
                    new AiConfirmationCandidateResponse(candidate.teamId(), candidate.projectId(), candidate.projectName())
                )
                .toList(),
            view.error()
        );
    }

    public record AiConfirmationCandidateResponse(Long teamId, Long projectId, String projectName) {}
}
