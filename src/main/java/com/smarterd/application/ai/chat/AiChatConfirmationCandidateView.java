package com.smarterd.application.ai.chat;

public record AiChatConfirmationCandidateView(
    String id,
    String label,
    String kind,
    Long teamId,
    String teamName,
    Long projectId,
    String projectName,
    String reason
) {
    static AiChatConfirmationCandidateView from(AiChatProjectCandidate candidate) {
        return new AiChatConfirmationCandidateView(
            "project:" + candidate.projectId(),
            candidate.projectName(),
            "project",
            candidate.teamId(),
            null,
            candidate.projectId(),
            candidate.projectName(),
            null
        );
    }
}
