package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiChatView;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "AI chat execution response")
public record AiChatResponse(
    @Schema(description = "Chat response status", example = "ANSWER") String status,

    @Schema(description = "AI execution id", example = "exec-1") String executionId,

    @Schema(description = "Whether the answer requires user confirmation", example = "false")
    boolean requiresConfirmation,

    @Schema(description = "Reason confirmation is required") String confirmationReason,

    @Schema(description = "Confirmation candidates") List<AiConfirmationCandidateResponse> confirmationCandidates,

    @Schema(description = "Resolved chat context") AiChatContextResponse context,

    @Schema(description = "Source chips for the answer") List<AiChatSourceChipResponse> sourceChips,

    @Schema(description = "Answer conclusion") String conclusion,

    @Schema(description = "Confirmed factual statements") List<String> confirmedFacts,

    @Schema(description = "AI interpretation") String interpretation,

    @Schema(description = "Facts requiring confirmation") List<String> needsConfirmation,

    @Schema(description = "Sanitized action proposals") List<AiActionProposalResponse> proposals,

    @Schema(description = "Legacy error summary") String error,

    @Schema(description = "Structured error state") AiChatErrorResponse errorState
) {
    /**
     * Maps the application chat view into the REST response contract.
     *
     * @param view application chat view
     * @return REST chat response
     */
    public static AiChatResponse from(AiChatView view) {
        return new AiChatResponse(
            view.status(),
            view.executionId(),
            view.requiresConfirmation(),
            view.confirmationReason(),
            view.confirmationCandidates().stream().map(AiConfirmationCandidateResponse::from).toList(),
            AiChatContextResponse.from(view.context()),
            view.sourceChips().stream().map(AiChatSourceChipResponse::from).toList(),
            view.conclusion(),
            view.confirmedFacts(),
            view.interpretation(),
            view.needsConfirmation(),
            view.proposals().stream().map(AiActionProposalResponse::from).toList(),
            view.error(),
            AiChatErrorResponse.from(view.errorState())
        );
    }
}
