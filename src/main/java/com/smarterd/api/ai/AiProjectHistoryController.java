package com.smarterd.api.ai;

import com.smarterd.api.ai.dto.AiProjectHistoryResponse;
import com.smarterd.application.ai.history.AiProjectHistoryService;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
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
    @GetMapping
    public ResponseEntity<AiProjectHistoryResponse> getProjectHistory(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable Long teamId,
        @PathVariable Long projectId,
        @RequestParam(defaultValue = "50") Integer limit
    ) {
        if (jwt == null) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code());
        }
        return ResponseEntity.ok(
            AiProjectHistoryResponse.from(historyService.getProjectHistory(jwt.getSubject(), teamId, projectId, limit))
        );
    }
}
