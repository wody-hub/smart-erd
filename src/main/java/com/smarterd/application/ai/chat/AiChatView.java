package com.smarterd.application.ai.chat;

import com.smarterd.application.ai.proposal.AiActionProposalView;
import java.util.List;

public record AiChatView(
    String status,
    String executionId,
    boolean requiresConfirmation,
    String confirmationReason,
    AiChatContextView context,
    String conclusion,
    String interpretation,
    List<String> confirmedFacts,
    List<String> needsConfirmation,
    List<AiReadContextService.SourceChip> sourceChips,
    List<AiChatConfirmationCandidateView> confirmationCandidates,
    List<AiActionProposalView> proposals,
    String error,
    AiChatErrorView errorState
) {
    /**
     * Creates a backward-compatible view for older tests and callers.
     *
     * @param status chat status
     * @param conclusion leading conclusion text
     * @param interpretation provider answer text
     * @param confirmedFacts confirmed facts
     * @param needsConfirmation missing confirmation items
     * @param sourceChips source chips
     * @param confirmationCandidates project confirmation candidates
     * @param error safe error text
     * @return initialized chat view
     */
    public AiChatView(
        String status,
        String conclusion,
        String interpretation,
        List<String> confirmedFacts,
        List<String> needsConfirmation,
        List<AiReadContextService.SourceChip> sourceChips,
        List<AiChatProjectCandidate> confirmationCandidates,
        String error
    ) {
        this(
            status,
            null,
            "NEEDS_CONFIRMATION".equals(status),
            null,
            null,
            conclusion,
            interpretation,
            confirmedFacts,
            needsConfirmation,
            sourceChips,
            confirmationCandidates.stream().map(AiChatConfirmationCandidateView::from).toList(),
            List.of(),
            error,
            error == null ? null : new AiChatErrorView("AI_CHAT_ERROR", error, false)
        );
    }

    public AiChatView {
        confirmedFacts = confirmedFacts == null ? List.of() : List.copyOf(confirmedFacts);
        needsConfirmation = needsConfirmation == null ? List.of() : List.copyOf(needsConfirmation);
        sourceChips = sourceChips == null ? List.of() : List.copyOf(sourceChips);
        confirmationCandidates = confirmationCandidates == null ? List.of() : List.copyOf(confirmationCandidates);
        proposals = proposals == null ? List.of() : List.copyOf(proposals);
    }

    /**
     * Creates a scope-confirmation response without project candidates.
     *
     * @param needsConfirmation missing confirmation items
     * @param candidates project confirmation candidates
     * @return confirmation chat view
     */
    public static AiChatView needsConfirmation(
        List<String> needsConfirmation,
        List<AiChatProjectCandidate> candidates
    ) {
        return needsConfirmation(needsConfirmation, candidates, null);
    }

    /**
     * Creates a scope-confirmation response with a stable reason code.
     *
     * @param needsConfirmation missing confirmation items
     * @param candidates project confirmation candidates
     * @param confirmationReason stable confirmation reason
     * @return confirmation chat view
     */
    public static AiChatView needsConfirmation(
        List<String> needsConfirmation,
        List<AiChatProjectCandidate> candidates,
        String confirmationReason
    ) {
        final var safeNeedsConfirmation =
            needsConfirmation == null ? List.<String>of() : List.copyOf(needsConfirmation);
        final var safeCandidates = candidates == null ? List.<AiChatProjectCandidate>of() : candidates;
        return new AiChatView(
            "NEEDS_CONFIRMATION",
            null,
            true,
            confirmationReason == null && !safeNeedsConfirmation.isEmpty()
                ? safeNeedsConfirmation.getFirst()
                : confirmationReason,
            null,
            "질문 범위를 먼저 확인해야 합니다.",
            "",
            List.of(),
            safeNeedsConfirmation,
            List.of(),
            safeCandidates.stream().map(AiChatConfirmationCandidateView::from).toList(),
            List.of(),
            null,
            null
        );
    }

    /**
     * Creates a structured chat error response.
     *
     * @param code error code
     * @param message safe error message
     * @param retryable retry hint
     * @param needsConfirmation missing confirmation items
     * @return error chat view
     */
    public static AiChatView error(String code, String message, boolean retryable, List<String> needsConfirmation) {
        return new AiChatView(
            "ERROR",
            null,
            false,
            null,
            null,
            "",
            "",
            List.of(),
            needsConfirmation,
            List.of(),
            List.of(),
            List.of(),
            message,
            new AiChatErrorView(code, message, retryable)
        );
    }
}
