package com.smarterd.api.project;

import com.smarterd.api.project.dto.issue.CreateProjectIssueRequest;
import com.smarterd.api.project.dto.issue.ProjectIssueListResponse;
import com.smarterd.api.project.dto.issue.ProjectIssueResponse;
import com.smarterd.api.project.dto.issue.UpdateProjectIssueStatusRequest;
import com.smarterd.api.project.dto.issue.UpdateProjectIssueRequest;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import com.smarterd.utils.ExcelUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 프로젝트 이슈 REST 컨트롤러.
 */
@Tag(name = "Project Issues", description = "프로젝트 이슈 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/issues")
@RequiredArgsConstructor
public class ProjectIssueController {

    private final ProjectIssueService projectIssueService;

    /**
     * 프로젝트 이슈 목록을 필터 조건과 함께 조회한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param status 상태 필터
     * @param statuses 상태 필터(하위 호환)
     * @param priority 우선순위 필터
     * @param priorities 우선순위 필터(하위 호환)
     * @param assigneeUserId 담당자 사용자 ID 필터
     * @param assigneeIds 담당자 사용자 ID 필터(하위 호환)
     * @param unassignedOnly 미배정 이슈만 조회 여부
     * @param includeUnassigned 미배정 이슈 포함 여부(하위 호환)
     * @return 필터링된 프로젝트 이슈 목록
     */
    @Operation(summary = "프로젝트 이슈 목록 조회")
    @GetMapping
    public ResponseEntity<ProjectIssueListResponse> getProjectIssues(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "상태 필터") @RequestParam(required = false) ProjectIssueStatus status,
        @Parameter(description = "상태 필터(하위 호환)") @RequestParam(required = false) List<ProjectIssueStatus> statuses,
        @Parameter(description = "우선순위 필터") @RequestParam(required = false) ProjectIssuePriority priority,
        @Parameter(description = "우선순위 필터(하위 호환)") @RequestParam(required = false) List<ProjectIssuePriority> priorities,
        @Parameter(description = "담당자 사용자 ID 필터") @RequestParam(required = false) Long assigneeUserId,
        @Parameter(description = "담당자 사용자 ID 필터(하위 호환)") @RequestParam(required = false) List<Long> assigneeIds,
        @Parameter(description = "미배정 이슈만 조회 여부") @RequestParam(defaultValue = "false") boolean unassignedOnly,
        @Parameter(description = "미배정 이슈 포함 여부") @RequestParam(defaultValue = "false") boolean includeUnassigned
    ) {
        final var result = projectIssueService.getProjectIssues(
            jwt.getSubject(),
            teamId,
            projectId,
            buildQuery(status, statuses, priority, priorities, assigneeUserId, assigneeIds, unassignedOnly, includeUnassigned)
        );
        final var items = result.stream().map(ProjectIssueResponse::from).toList();
        return ResponseEntity.ok(ProjectIssueListResponse.from(items));
    }

    /**
     * 프로젝트 이슈를 생성한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param request 생성 요청
     * @return 생성된 프로젝트 이슈
     */
    @Operation(summary = "프로젝트 이슈 생성")
    @ApiResponse(
        responseCode = "201",
        description = "생성 성공",
        content = @Content(schema = @Schema(implementation = ProjectIssueResponse.class))
    )
    @PostMapping
    public ResponseEntity<ProjectIssueResponse> createProjectIssue(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody CreateProjectIssueRequest request
    ) {
        final var result = projectIssueService.createProjectIssue(
            jwt.getSubject(),
            teamId,
            projectId,
            new ProjectIssueService.CreateProjectIssueCommand(
                request.title(),
                request.description(),
                request.priority(),
                request.assigneeUserId()
            )
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ProjectIssueResponse.from(result));
    }

    /**
     * 프로젝트 이슈의 제목/내용/우선순위/담당자를 수정한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param issueId 이슈 ID
     * @param request 수정 요청
     * @return 수정된 프로젝트 이슈
     */
    @Operation(summary = "프로젝트 이슈 수정")
    @PutMapping("/{issueId}")
    public ResponseEntity<ProjectIssueResponse> updateProjectIssue(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "이슈 ID") @PathVariable Long issueId,
        @Valid @RequestBody UpdateProjectIssueRequest request
    ) {
        final var result = projectIssueService.updateProjectIssue(
            jwt.getSubject(),
            teamId,
            projectId,
            issueId,
            new ProjectIssueService.UpdateProjectIssueCommand(
                request.title(),
                request.description(),
                request.priority(),
                request.assigneeUserId()
            )
        );
        return ResponseEntity.ok(ProjectIssueResponse.from(result));
    }

    /**
     * 프로젝트 이슈 상태를 다음 전진 단계로 이동한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param issueId 이슈 ID
     * @param request 상태 변경 요청
     * @return 상태가 전진된 프로젝트 이슈
     */
    @Operation(summary = "프로젝트 이슈 상태 변경")
    @PatchMapping("/{issueId}/status")
    public ResponseEntity<ProjectIssueResponse> updateProjectIssueStatus(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "이슈 ID") @PathVariable Long issueId,
        @Valid @RequestBody UpdateProjectIssueStatusRequest request
    ) {
        final var result = projectIssueService.updateProjectIssueStatus(
            jwt.getSubject(),
            teamId,
            projectId,
            issueId,
            request.status()
        );
        return ResponseEntity.ok(ProjectIssueResponse.from(result));
    }

    /**
     * 프로젝트 이슈 상태를 다음 전진 단계로 이동한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param issueId 이슈 ID
     * @return 상태가 전진된 프로젝트 이슈
     */
    @Operation(summary = "프로젝트 이슈 상태 전진")
    @PatchMapping("/{issueId}/advance")
    public ResponseEntity<ProjectIssueResponse> advanceProjectIssueStatus(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "이슈 ID") @PathVariable Long issueId
    ) {
        final var result = projectIssueService.advanceProjectIssueStatus(jwt.getSubject(), teamId, projectId, issueId);
        return ResponseEntity.ok(ProjectIssueResponse.from(result));
    }

    /**
     * 현재 필터 조건의 프로젝트 이슈를 엑셀로 다운로드한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param status 상태 필터
     * @param statuses 상태 필터(하위 호환)
     * @param priority 우선순위 필터
     * @param priorities 우선순위 필터(하위 호환)
     * @param assigneeUserId 담당자 사용자 ID 필터
     * @param assigneeIds 담당자 사용자 ID 필터(하위 호환)
     * @param unassignedOnly 미배정 이슈만 조회 여부
     * @param includeUnassigned 미배정 포함 여부(하위 호환)
     * @param response HTTP 응답
     * @throws IOException 다운로드 중 I/O 오류가 발생한 경우
     */
    @Operation(summary = "프로젝트 이슈 엑셀 다운로드")
    @ApiResponse(responseCode = "200", description = "다운로드 성공")
    @GetMapping("/download/excel")
    public void downloadProjectIssuesExcel(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "상태 필터") @RequestParam(required = false) ProjectIssueStatus status,
        @Parameter(description = "상태 필터(하위 호환)") @RequestParam(required = false) List<ProjectIssueStatus> statuses,
        @Parameter(description = "우선순위 필터") @RequestParam(required = false) ProjectIssuePriority priority,
        @Parameter(description = "우선순위 필터(하위 호환)") @RequestParam(required = false) List<ProjectIssuePriority> priorities,
        @Parameter(description = "담당자 사용자 ID 필터") @RequestParam(required = false) Long assigneeUserId,
        @Parameter(description = "담당자 사용자 ID 필터(하위 호환)") @RequestParam(required = false) List<Long> assigneeIds,
        @Parameter(description = "미배정 이슈만 조회 여부") @RequestParam(defaultValue = "false") boolean unassignedOnly,
        @Parameter(description = "미배정 이슈 포함 여부") @RequestParam(defaultValue = "false") boolean includeUnassigned,
        HttpServletResponse response
    ) throws IOException {
        final var excelData = projectIssueService.exportProjectIssues(
            jwt.getSubject(),
            teamId,
            projectId,
            buildQuery(status, statuses, priority, priorities, assigneeUserId, assigneeIds, unassignedOnly, includeUnassigned)
        );
        ExcelUtils.download(excelData, response);
    }

    private ProjectIssueService.ProjectIssueQuery buildQuery(
        ProjectIssueStatus status,
        List<ProjectIssueStatus> statuses,
        ProjectIssuePriority priority,
        List<ProjectIssuePriority> priorities,
        Long assigneeUserId,
        List<Long> assigneeIds,
        boolean unassignedOnly,
        boolean includeUnassigned
    ) {
        return new ProjectIssueService.ProjectIssueQuery(
            mergeFilterValues(status, statuses),
            mergeFilterValues(priority, priorities),
            mergeFilterValues(assigneeUserId, assigneeIds),
            unassignedOnly || includeUnassigned
        );
    }

    private <T> List<T> mergeFilterValues(T singleValue, List<T> multiValues) {
        final var merged = new ArrayList<T>();
        if (singleValue != null) {
            merged.add(singleValue);
        }
        if (multiValues != null) {
            merged.addAll(multiValues);
        }
        return List.copyOf(new LinkedHashSet<>(merged));
    }
}
