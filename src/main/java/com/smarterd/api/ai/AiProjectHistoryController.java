package com.smarterd.api.ai;

import static com.smarterd.api.ai.AiAuthenticationSupport.subject;

import com.smarterd.api.ai.dto.AiProjectHistoryResponse;
import com.smarterd.application.ai.history.AiProjectHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only project AI activity history REST controller.
 */
@Tag(name = "AI Project History", description = "Project AI activity history APIs")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/ai-history")
@RequiredArgsConstructor
public class AiProjectHistoryController {

    private final AiProjectHistoryService historyService;

    /**
     * Returns redacted AI execution and proposal history for one project.
     *
     * @param jwt authenticated principal
     * @param teamId team id
     * @param projectId project id
     * @param limit optional item limit
     * @return project AI history response
     */
    @Operation(
        summary = "Get project AI history",
        description = "Returns redacted AI execution and proposal history for one project."
    )
    @ApiResponse(
        responseCode = "200",
        description = "History returned",
        content = @Content(schema = @Schema(implementation = AiProjectHistoryResponse.class))
    )
    @ApiResponse(responseCode = "403", description = "Project AI history access denied", content = @Content)
    @GetMapping
    public ResponseEntity<AiProjectHistoryResponse> getProjectHistory(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable Long teamId,
        @PathVariable Long projectId,
        @RequestParam(defaultValue = "50") Integer limit
    ) {
        return ResponseEntity.ok(
            AiProjectHistoryResponse.from(historyService.getProjectHistory(subject(jwt), teamId, projectId, limit))
        );
    }
}
