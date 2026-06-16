package com.smarterd.api.project;

import com.smarterd.api.project.dto.staffing.CreateProjectStaffingRequest;
import com.smarterd.api.project.dto.staffing.ProjectStaffingListResponse;
import com.smarterd.api.project.dto.staffing.ProjectStaffingResourceResponse;
import com.smarterd.api.project.dto.staffing.UpdateProjectStaffingRequest;
import com.smarterd.domain.pm.staffing.service.ProjectStaffingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 프로젝트 인력 투입 REST 컨트롤러.
 */
@Tag(name = "Project Staffing", description = "프로젝트 인력 투입 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/staffing")
@RequiredArgsConstructor
public class ProjectStaffingController {

    private final ProjectStaffingService projectStaffingService;

    @Operation(summary = "프로젝트 인력 투입 목록 조회")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = ProjectStaffingListResponse.class))
    )
    @GetMapping
    public ResponseEntity<ProjectStaffingListResponse> getProjectStaffing(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            ProjectStaffingListResponse.from(
                projectStaffingService.getProjectStaffing(jwt.getSubject(), teamId, projectId)
            )
        );
    }

    @Operation(summary = "프로젝트 인력 투입 생성")
    @ApiResponse(
        responseCode = "201",
        description = "생성 성공",
        content = @Content(schema = @Schema(implementation = ProjectStaffingResourceResponse.class))
    )
    @PostMapping
    public ResponseEntity<ProjectStaffingResourceResponse> createProjectStaffing(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody CreateProjectStaffingRequest request
    ) {
        final var command = new ProjectStaffingService.CreateProjectStaffingCommand(
            request.userId(),
            request.grade(),
            request.monthlyRate(),
            request.plannedStartDate(),
            request.plannedEndDate(),
            request.plannedParticipationRate(),
            request.actualStartDate(),
            request.actualEndDate(),
            request.actualParticipationRate()
        );
        final var result = projectStaffingService.createProjectStaffing(jwt.getSubject(), teamId, projectId, command);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProjectStaffingResourceResponse.from(result));
    }

    @Operation(summary = "프로젝트 인력 투입 수정")
    @ApiResponse(
        responseCode = "200",
        description = "수정 성공",
        content = @Content(schema = @Schema(implementation = ProjectStaffingResourceResponse.class))
    )
    @PutMapping("/{staffingId}")
    public ResponseEntity<ProjectStaffingResourceResponse> updateProjectStaffing(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "인력 투입 ID") @PathVariable Long staffingId,
        @Valid @RequestBody UpdateProjectStaffingRequest request
    ) {
        final var command = new ProjectStaffingService.UpdateProjectStaffingCommand(
            request.grade(),
            request.monthlyRate(),
            request.plannedStartDate(),
            request.plannedEndDate(),
            request.plannedParticipationRate(),
            request.actualStartDate(),
            request.actualEndDate(),
            request.actualParticipationRate()
        );
        final var result = projectStaffingService.updateProjectStaffing(
            jwt.getSubject(),
            teamId,
            projectId,
            staffingId,
            command
        );
        return ResponseEntity.ok(ProjectStaffingResourceResponse.from(result));
    }

    @Operation(summary = "프로젝트 인력 투입 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공", content = @Content)
    @DeleteMapping("/{staffingId}")
    public ResponseEntity<Void> deleteProjectStaffing(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "인력 투입 ID") @PathVariable Long staffingId
    ) {
        projectStaffingService.deleteProjectStaffing(jwt.getSubject(), teamId, projectId, staffingId);
        return ResponseEntity.noContent().build();
    }
}
