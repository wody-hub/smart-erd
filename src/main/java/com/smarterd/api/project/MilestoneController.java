package com.smarterd.api.project;

import com.smarterd.api.project.dto.milestone.CreateMilestoneRequest;
import com.smarterd.api.project.dto.milestone.MilestoneResponse;
import com.smarterd.api.project.dto.milestone.UpdateMilestoneRequest;
import com.smarterd.domain.pm.milestone.service.MilestoneService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
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
 * 마일스톤 REST 컨트롤러.
 */
@Tag(name = "Milestone", description = "마일스톤 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/milestones")
@RequiredArgsConstructor
public class MilestoneController {

    private final MilestoneService milestoneService;

    @Operation(summary = "마일스톤 목록 조회")
    @GetMapping
    public ResponseEntity<List<MilestoneResponse>> getMilestones(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            milestoneService
                .getMilestones(jwt.getSubject(), teamId, projectId)
                .stream()
                .map(MilestoneResponse::from)
                .toList()
        );
    }

    @Operation(summary = "마일스톤 생성")
    @ApiResponse(
        responseCode = "201",
        description = "생성 성공",
        content = @Content(schema = @Schema(implementation = MilestoneResponse.class))
    )
    @PostMapping
    public ResponseEntity<MilestoneResponse> createMilestone(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody CreateMilestoneRequest request
    ) {
        final var result = milestoneService.createMilestone(
            jwt.getSubject(),
            teamId,
            projectId,
            request.name(),
            request.targetDate(),
            request.description()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(MilestoneResponse.from(result));
    }

    @Operation(summary = "마일스톤 수정")
    @PutMapping("/{milestoneId}")
    public ResponseEntity<MilestoneResponse> updateMilestone(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "마일스톤 ID") @PathVariable Long milestoneId,
        @Valid @RequestBody UpdateMilestoneRequest request
    ) {
        final var result = milestoneService.updateMilestone(
            jwt.getSubject(),
            teamId,
            projectId,
            milestoneId,
            request.name(),
            request.targetDate(),
            request.description()
        );
        return ResponseEntity.ok(MilestoneResponse.from(result));
    }

    @Operation(summary = "마일스톤 삭제")
    @DeleteMapping("/{milestoneId}")
    public ResponseEntity<Void> deleteMilestone(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "마일스톤 ID") @PathVariable Long milestoneId
    ) {
        milestoneService.deleteMilestone(jwt.getSubject(), teamId, projectId, milestoneId);
        return ResponseEntity.noContent().build();
    }
}
