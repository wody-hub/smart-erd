package com.smarterd.api.project;

import com.smarterd.api.project.dto.wbs.BulkCreateWbsItemsRequest;
import com.smarterd.api.project.dto.wbs.BulkCreateWbsItemsResponse;
import com.smarterd.api.project.dto.wbs.DuplicateWbsSubtreeRequest;
import com.smarterd.api.project.dto.wbs.InstantiateWbsTemplateRequest;
import com.smarterd.api.project.dto.wbs.SaveWbsTemplateRequest;
import com.smarterd.api.project.dto.wbs.WbsSubtreeMutationResponse;
import com.smarterd.api.project.dto.wbs.WbsTemplateResponse;
import com.smarterd.domain.pm.wbs.service.WbsPlanningService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WBS planning REST 컨트롤러.
 */
@Tag(name = "WBS Planning", description = "WBS 복제/템플릿/대량 생성 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/wbs")
@RequiredArgsConstructor
public class WbsPlanningController {

    private final WbsPlanningService wbsPlanningService;

    /**
     * WBS subtree를 복제한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param wbsItemId 복제할 subtree 루트 WBS ID
     * @param request subtree 복제 요청
     * @return 복제된 subtree 결과
     */
    @Operation(summary = "WBS subtree 복제")
    @ApiResponse(responseCode = "201", description = "복제 성공")
    @PostMapping("/{wbsItemId}/subtree-copies")
    public ResponseEntity<WbsSubtreeMutationResponse> duplicateSubtree(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "복제할 subtree 루트 WBS ID") @PathVariable Long wbsItemId,
        @Valid @RequestBody DuplicateWbsSubtreeRequest request
    ) {
        final var result = wbsPlanningService.duplicateSubtree(
            jwt.getSubject(),
            teamId,
            projectId,
            wbsItemId,
            new WbsPlanningService.DuplicateSubtreeCommand(
                request.parentId(),
                request.resetAssignee(),
                request.resetSchedule(),
                request.resetProgress(),
                request.resetMilestone(),
                request.includeDependencies()
            )
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(WbsSubtreeMutationResponse.from(result));
    }

    /**
     * WBS 템플릿 목록을 조회한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @return WBS 템플릿 목록
     */
    @Operation(summary = "WBS 템플릿 목록 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @GetMapping("/templates")
    public ResponseEntity<List<WbsTemplateResponse>> getTemplates(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            wbsPlanningService
                .getTemplates(jwt.getSubject(), teamId, projectId)
                .stream()
                .map(WbsTemplateResponse::from)
                .toList()
        );
    }

    /**
     * WBS 템플릿을 저장한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param request 템플릿 저장 요청
     * @return 저장된 WBS 템플릿
     */
    @Operation(summary = "WBS 템플릿 저장")
    @ApiResponse(responseCode = "201", description = "저장 성공")
    @PostMapping("/templates")
    public ResponseEntity<WbsTemplateResponse> saveTemplate(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody SaveWbsTemplateRequest request
    ) {
        final var result = wbsPlanningService.saveTemplate(
            jwt.getSubject(),
            teamId,
            projectId,
            new WbsPlanningService.SaveTemplateCommand(request.sourceWbsItemId(), request.name(), request.description())
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(WbsTemplateResponse.from(result));
    }

    /**
     * WBS 템플릿을 프로젝트 WBS에 적용한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param templateId 템플릿 ID
     * @param request 템플릿 적용 요청
     * @return 생성된 WBS subtree 결과
     */
    @Operation(summary = "WBS 템플릿 적용")
    @ApiResponse(responseCode = "201", description = "적용 성공")
    @PostMapping("/templates/{templateId}/instantiations")
    public ResponseEntity<WbsSubtreeMutationResponse> instantiateTemplate(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "템플릿 ID") @PathVariable Long templateId,
        @Valid @RequestBody InstantiateWbsTemplateRequest request
    ) {
        final var result = wbsPlanningService.instantiateTemplate(
            jwt.getSubject(),
            teamId,
            projectId,
            templateId,
            new WbsPlanningService.InstantiateTemplateCommand(
                request.parentId(),
                request.resetAssignee(),
                request.resetSchedule(),
                request.resetProgress(),
                request.resetMilestone(),
                request.includeDependencies()
            )
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(WbsSubtreeMutationResponse.from(result));
    }

    /**
     * WBS 항목을 대량 생성한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param request 대량 생성 요청
     * @return 대량 생성 결과
     */
    @Operation(summary = "WBS 대량 생성")
    @ApiResponse(responseCode = "201", description = "대량 생성 성공")
    @PostMapping("/batches")
    public ResponseEntity<BulkCreateWbsItemsResponse> bulkCreate(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody BulkCreateWbsItemsRequest request
    ) {
        final var result = wbsPlanningService.bulkCreate(
            jwt.getSubject(),
            teamId,
            projectId,
            new WbsPlanningService.BulkCreateCommand(
                request
                    .items()
                    .stream()
                    .map((item) ->
                        new WbsPlanningService.BulkCreateItemCommand(
                            item.clientKey(),
                            item.parentId(),
                            item.parentClientKey(),
                            item.name(),
                            item.assigneeUserId(),
                            item.startDate(),
                            item.endDate(),
                            item.progressRate(),
                            item.estimatedMm(),
                            item.milestoneId()
                        )
                    )
                    .toList()
            )
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(BulkCreateWbsItemsResponse.from(result));
    }
}
