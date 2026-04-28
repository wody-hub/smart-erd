package com.smarterd.api.project;

import com.smarterd.api.project.dto.todo.SharedTodoSummaryResponse;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WBS에 연결된 공유 TODO 요약 조회 컨트롤러.
 */
@Tag(name = "WBS Todos", description = "WBS 연결 TODO 공유 요약 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/wbs/{wbsItemId}/todos")
@RequiredArgsConstructor
public class WbsTodoController {

    private final ProjectTodoService projectTodoService;

    @Operation(summary = "WBS 연결 TODO 공유 요약 조회")
    @GetMapping
    public ResponseEntity<List<SharedTodoSummaryResponse>> getSharedTodoSummaries(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId
    ) {
        return ResponseEntity.ok(
            projectTodoService
                .getSharedTodoSummariesByWbs(jwt.getSubject(), teamId, projectId, wbsItemId)
                .stream()
                .map(SharedTodoSummaryResponse::from)
                .toList()
        );
    }
}
