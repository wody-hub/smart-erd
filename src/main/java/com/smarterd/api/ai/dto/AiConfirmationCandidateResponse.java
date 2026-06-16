package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiChatConfirmationCandidateView;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Project or team candidate that can disambiguate an AI chat request.
 *
 * @param id candidate id
 * @param label display label
 * @param kind candidate kind
 * @param teamId team id
 * @param teamName team name
 * @param projectId project id
 * @param projectName project name
 * @param reason match reason
 */
@Schema(description = "AI chat confirmation candidate")
public record AiConfirmationCandidateResponse(
    @Schema(description = "Candidate id", example = "project:10") String id,

    @Schema(description = "Candidate display label", example = "Alpha Project") String label,

    @Schema(description = "Candidate kind", example = "project") String kind,

    @Schema(description = "Team id", example = "1") Long teamId,

    @Schema(description = "Team name", example = "Platform Team") String teamName,

    @Schema(description = "Project id", example = "10") Long projectId,

    @Schema(description = "Project name", example = "Alpha Project") String projectName,

    @Schema(description = "Candidate match reason", example = "exact") String reason
) {
    /**
     * Maps a project confirmation candidate into the API response shape.
     *
     * @param candidate application confirmation candidate
     * @return API confirmation candidate
     */
    static AiConfirmationCandidateResponse from(AiChatConfirmationCandidateView candidate) {
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
