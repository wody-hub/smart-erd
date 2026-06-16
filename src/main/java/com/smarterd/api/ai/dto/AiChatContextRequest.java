package com.smarterd.api.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Route or user-selected context supplied with an AI chat request.
 *
 * @param kind context kind
 * @param teamId team id
 * @param teamName team name
 * @param projectId project id
 * @param projectName project name
 * @param source context source
 * @param capturedAt context capture timestamp
 * @param confidence context confidence label
 * @param scopeRequired whether explicit scope confirmation is required
 */
@Schema(description = "AI chat context request")
public record AiChatContextRequest(
    @Schema(description = "Context kind", example = "project")
    @Size(max = 40, message = "{validation.size.ai-context-short-text}")
    String kind,

    @Schema(description = "Team id", example = "1") Long teamId,

    @Schema(description = "Team name", example = "Platform Team")
    @Size(max = 120, message = "{validation.size.ai-context-label}")
    String teamName,

    @Schema(description = "Project id", example = "10") Long projectId,

    @Schema(description = "Project name", example = "Alpha Project")
    @Size(max = 120, message = "{validation.size.ai-context-label}")
    String projectName,

    @Schema(description = "Context source", example = "route")
    @Size(max = 40, message = "{validation.size.ai-context-short-text}")
    String source,

    @Schema(description = "Context capture timestamp", example = "2026-06-02T06:00:00Z")
    @Size(max = 40, message = "{validation.size.ai-context-short-text}")
    String capturedAt,

    @Schema(description = "Context confidence", example = "strong")
    @Size(max = 40, message = "{validation.size.ai-context-short-text}")
    String confidence,

    @Schema(description = "Whether explicit scope confirmation is required", example = "false") Boolean scopeRequired
) {}
