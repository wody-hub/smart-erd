package com.smarterd.application.ai.chat;

import java.util.List;

public record AiChatResolvedContext(
    AiChatScopeStatus status,
    Long teamId,
    List<Long> projectIds,
    String label,
    List<AiChatProjectCandidate> confirmationCandidates,
    List<String> needsConfirmation,
    AiChatConfirmationReason confirmationReason
) {
    public AiChatResolvedContext {
        projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
        confirmationCandidates = confirmationCandidates == null ? List.of() : List.copyOf(confirmationCandidates);
        needsConfirmation = needsConfirmation == null ? List.of() : List.copyOf(needsConfirmation);
    }

    public AiChatResolvedContext(
        AiChatScopeStatus status,
        Long teamId,
        List<Long> projectIds,
        String label,
        List<AiChatProjectCandidate> confirmationCandidates,
        List<String> needsConfirmation
    ) {
        this(status, teamId, projectIds, label, confirmationCandidates, needsConfirmation, null);
    }

    /**
     * Creates a confirmation-required scope with a custom message.
     *
     * @param label display label
     * @param message confirmation message
     * @return confirmation-required scope
     */
    public static AiChatResolvedContext needsConfirmation(String label, String message) {
        return new AiChatResolvedContext(
            AiChatScopeStatus.NEEDS_CONFIRMATION,
            null,
            List.of(),
            label,
            List.of(),
            List.of(message),
            AiChatConfirmationReason.WEAK_SCOPE
        );
    }

    /**
     * Creates a confirmation-required scope for a reason.
     *
     * @param reason confirmation reason
     * @return confirmation-required scope
     */
    public static AiChatResolvedContext needsConfirmation(AiChatConfirmationReason reason) {
        return needsConfirmation(reason, List.of());
    }

    /**
     * Creates a confirmation-required scope with project candidates.
     *
     * @param reason confirmation reason
     * @param confirmationCandidates candidate projects
     * @return confirmation-required scope
     */
    public static AiChatResolvedContext needsConfirmation(
        AiChatConfirmationReason reason,
        List<AiChatProjectCandidate> confirmationCandidates
    ) {
        return new AiChatResolvedContext(
            AiChatScopeStatus.NEEDS_CONFIRMATION,
            null,
            List.of(),
            reason.name(),
            confirmationCandidates,
            List.of(reason.messageCode()),
            reason
        );
    }

    /**
     * Creates a denied scope for a reason.
     *
     * @param reason denial reason
     * @return denied scope
     */
    public static AiChatResolvedContext denied(AiChatConfirmationReason reason) {
        return new AiChatResolvedContext(
            AiChatScopeStatus.DENIED,
            null,
            List.of(),
            reason.name(),
            List.of(),
            List.of(reason.messageCode()),
            reason
        );
    }

    /**
     * Creates a resolved scope.
     *
     * @param teamId team id
     * @param projectIds project ids in scope
     * @param label display label
     * @return resolved scope
     */
    public static AiChatResolvedContext resolved(Long teamId, List<Long> projectIds, String label) {
        return new AiChatResolvedContext(
            AiChatScopeStatus.RESOLVED,
            teamId,
            projectIds,
            label,
            List.of(),
            List.of(),
            null
        );
    }

    /**
     * Checks whether this scope can be used for provider execution.
     *
     * @return true when resolved
     */
    public boolean isResolved() {
        return status == AiChatScopeStatus.RESOLVED;
    }
}
