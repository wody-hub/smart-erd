package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiChatExecutionService;
import java.util.List;
import java.util.Map;

public record AiChatResponse(
    String status,
    String executionId,
    boolean requiresConfirmation,
    String confirmationReason,
    List<AiConfirmationCandidateResponse> confirmationCandidates,
    AiChatContextResponse context,
    List<AiChatSourceChipResponse> sourceChips,
    String conclusion,
    List<String> confirmedFacts,
    String interpretation,
    List<String> needsConfirmation,
    List<AiActionProposalResponse> proposals,
    String error,
    AiChatErrorResponse errorState
) {
    /**
     * Maps the application chat view into the REST response contract.
     *
     * @param view application chat view
     * @return REST chat response
     */
    public static AiChatResponse from(AiChatExecutionService.AiChatView view) {
        return new AiChatResponse(
            view.status(),
            view.executionId(),
            view.requiresConfirmation(),
            view.confirmationReason(),
            view
                .confirmationCandidates()
                .stream()
                .map(AiConfirmationCandidateResponse::from)
                .toList(),
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

    public record AiConfirmationCandidateResponse(
        String id,
        String label,
        String kind,
        Long teamId,
        String teamName,
        Long projectId,
        String projectName,
        String reason
        ) {
        /**
         * Maps a project confirmation candidate into the API response shape.
         */
        static AiConfirmationCandidateResponse from(
            AiChatExecutionService.AiChatConfirmationCandidateView candidate
        ) {
            return new AiConfirmationCandidateResponse(
                candidate.id(),
                candidate.label(),
                candidate.kind(),
                candidate.teamId(),
                candidate.teamName(),
                candidate.projectId(),
                candidate.projectName(),
                candidate.reason()
            );
        }
    }

    public record AiChatContextResponse(
        String kind,
        Long teamId,
        List<Long> projectIds,
        String label,
        List<String> toolsUsed,
        Map<String, Object> caps
    ) {
        public AiChatContextResponse {
            projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
            toolsUsed = toolsUsed == null ? List.of() : List.copyOf(toolsUsed);
            caps = caps == null ? Map.of() : Map.copyOf(caps);
        }

        /**
         * Maps optional resolved chat context into a nullable API context.
         *
         * @param context application context view
         * @return REST context response or null
         */
        private static AiChatContextResponse from(AiChatExecutionService.AiChatContextView context) {
            if (context == null) {
                return null;
            }
            return new AiChatContextResponse(
                context.kind(),
                context.teamId(),
                context.projectIds(),
                context.label(),
                context.toolsUsed(),
                context.caps()
            );
        }
    }

    public record AiChatErrorResponse(String code, String message, boolean retryable) {
        /**
         * Maps optional provider or chat error state into the API error card.
         *
         * @param error application error view
         * @return REST error response or null
         */
        private static AiChatErrorResponse from(AiChatExecutionService.AiChatErrorView error) {
            if (error == null) {
                return null;
            }
            return new AiChatErrorResponse(error.code(), error.message(), error.retryable());
        }
    }
}
