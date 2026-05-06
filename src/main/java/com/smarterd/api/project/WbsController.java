package com.smarterd.api.project;

import com.smarterd.api.project.dto.wbs.CreateWbsCommentRequest;
import com.smarterd.api.project.dto.wbs.CreateWbsDependencyRequest;
import com.smarterd.api.project.dto.wbs.WbsActivityResponse;
import com.smarterd.api.project.dto.wbs.WbsCommentResponse;
import com.smarterd.api.project.dto.wbs.BulkCreateWbsItemsRequest;
import com.smarterd.api.project.dto.wbs.BulkCreateWbsItemsResponse;
import com.smarterd.api.project.dto.wbs.CreateWbsItemRequest;
import com.smarterd.api.project.dto.wbs.DuplicateWbsSubtreeRequest;
import com.smarterd.api.project.dto.wbs.InstantiateWbsTemplateRequest;
import com.smarterd.api.project.dto.wbs.ReorderWbsItemsRequest;
import com.smarterd.api.project.dto.wbs.SaveWbsTemplateRequest;
import com.smarterd.api.project.dto.wbs.UpdateWbsDependencyRequest;
import com.smarterd.api.project.dto.wbs.UpdateWbsItemRequest;
import com.smarterd.api.project.dto.wbs.WbsDependencyResponse;
import com.smarterd.api.project.dto.wbs.WbsDependencyShiftRequest;
import com.smarterd.api.project.dto.wbs.WbsDependencyShiftResponse;
import com.smarterd.api.project.dto.wbs.WbsDocumentResponse;
import com.smarterd.api.project.dto.wbs.WbsDocumentTagResponse;
import com.smarterd.api.project.dto.wbs.WbsItemResponse;
import com.smarterd.api.project.dto.wbs.WbsSubtreeMutationResponse;
import com.smarterd.api.project.dto.wbs.WbsTemplateResponse;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.wbs.service.WbsDependencyService;
import com.smarterd.domain.pm.wbs.service.WbsDocumentService;
import com.smarterd.domain.pm.wbs.service.WbsPlanningService;
import com.smarterd.domain.pm.wbs.service.WbsService;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WBS 항목 REST 컨트롤러.
 */
@Tag(name = "WBS", description = "WBS 항목 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/wbs")
@RequiredArgsConstructor
public class WbsController {

    private final WbsService wbsService;
    private final WbsDependencyService wbsDependencyService;
    private final WbsDocumentService wbsDocumentService;
    private final WbsPlanningService wbsPlanningService;
    private final WorkItemHistoryService workItemHistoryService;

    @Operation(summary = "WBS 트리 조회")
    @GetMapping
    public ResponseEntity<List<WbsItemResponse>> getWbsItems(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            wbsService.getWbsItems(jwt.getSubject(), teamId, projectId).stream().map(WbsItemResponse::from).toList()
        );
    }

    @Operation(summary = "WBS dependency 목록 조회")
    @GetMapping("/dependencies")
    public ResponseEntity<List<WbsDependencyResponse>> getDependencies(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            wbsDependencyService
                .getDependencies(jwt.getSubject(), teamId, projectId)
                .stream()
                .map(WbsDependencyResponse::from)
                .toList()
        );
    }

    @Operation(summary = "WBS subtree 복제")
    @PostMapping("/{wbsItemId}/duplicate-subtree")
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

    @Operation(summary = "WBS 템플릿 목록 조회")
    @GetMapping("/templates")
    public ResponseEntity<List<WbsTemplateResponse>> getTemplates(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            wbsPlanningService.getTemplates(jwt.getSubject(), teamId, projectId).stream().map(WbsTemplateResponse::from).toList()
        );
    }

    @Operation(summary = "WBS 템플릿 저장")
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

    @Operation(summary = "WBS 템플릿 적용")
    @PostMapping("/templates/{templateId}/instantiate")
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

    @Operation(summary = "WBS 대량 생성")
    @PostMapping("/bulk-create")
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

    @Operation(summary = "WBS dependency shift preview")
    @PostMapping("/dependency-shift-preview")
    public ResponseEntity<WbsDependencyShiftResponse> previewDependencyShift(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody WbsDependencyShiftRequest request
    ) {
        final var result = wbsDependencyService.previewShift(
            jwt.getSubject(),
            teamId,
            projectId,
            request
                .anchors()
                .stream()
                .map((anchor) -> new WbsDependencyService.WbsDependencyShiftAnchorCommand(anchor.wbsItemId(), anchor.startDate(), anchor.endDate()))
                .toList()
        );
        return ResponseEntity.ok(WbsDependencyShiftResponse.from(result));
    }

    @Operation(summary = "WBS dependency shift apply")
    @PostMapping("/dependency-shift-apply")
    public ResponseEntity<WbsDependencyShiftResponse> applyDependencyShift(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody WbsDependencyShiftRequest request
    ) {
        final var result = wbsDependencyService.applyShift(
            jwt.getSubject(),
            teamId,
            projectId,
            request
                .anchors()
                .stream()
                .map((anchor) -> new WbsDependencyService.WbsDependencyShiftAnchorCommand(anchor.wbsItemId(), anchor.startDate(), anchor.endDate()))
                .toList()
        );
        return ResponseEntity.ok(WbsDependencyShiftResponse.from(result));
    }

    @Operation(summary = "WBS dependency 생성")
    @PostMapping("/dependencies")
    public ResponseEntity<WbsDependencyResponse> createDependency(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody CreateWbsDependencyRequest request
    ) {
        final var result = wbsDependencyService.createDependency(
            jwt.getSubject(),
            teamId,
            projectId,
            new WbsDependencyService.WbsDependencyCommand(
                request.predecessorWbsItemId(),
                request.successorWbsItemId(),
                request.dependencyType()
            )
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(WbsDependencyResponse.from(result));
    }

    @Operation(summary = "WBS dependency 수정")
    @PutMapping("/dependencies/{dependencyId}")
    public ResponseEntity<WbsDependencyResponse> updateDependency(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "dependency ID") @PathVariable Long dependencyId,
        @Valid @RequestBody UpdateWbsDependencyRequest request
    ) {
        final var result = wbsDependencyService.updateDependency(
            jwt.getSubject(),
            teamId,
            projectId,
            dependencyId,
            new WbsDependencyService.WbsDependencyCommand(
                request.predecessorWbsItemId(),
                request.successorWbsItemId(),
                request.dependencyType()
            )
        );
        return ResponseEntity.ok(WbsDependencyResponse.from(result));
    }

    @Operation(summary = "WBS dependency 삭제")
    @DeleteMapping("/dependencies/{dependencyId}")
    public ResponseEntity<Void> deleteDependency(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "dependency ID") @PathVariable Long dependencyId
    ) {
        wbsDependencyService.deleteDependency(jwt.getSubject(), teamId, projectId, dependencyId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "WBS 연결 문서 조회")
    @GetMapping("/{wbsItemId}/documents")
    public ResponseEntity<List<WbsDocumentResponse>> getLinkedDocuments(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId
    ) {
        return ResponseEntity.ok(
            wbsDocumentService
                .getLinkedDocuments(jwt.getSubject(), teamId, projectId, wbsItemId)
                .stream()
                .map(WbsDocumentResponse::from)
                .toList()
        );
    }

    @Operation(summary = "WBS 댓글 목록 조회")
    @GetMapping("/{wbsItemId}/comments")
    public ResponseEntity<List<WbsCommentResponse>> getWbsComments(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId
    ) {
        return ResponseEntity.ok(
            workItemHistoryService
                .getWbsComments(jwt.getSubject(), teamId, projectId, wbsItemId)
                .stream()
                .map(WbsCommentResponse::from)
                .toList()
        );
    }

    @Operation(summary = "WBS 댓글 작성")
    @PostMapping("/{wbsItemId}/comments")
    public ResponseEntity<WbsCommentResponse> addWbsComment(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId,
        @Valid @RequestBody CreateWbsCommentRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            WbsCommentResponse.from(
                workItemHistoryService.addWbsComment(jwt.getSubject(), teamId, projectId, wbsItemId, request.content())
            )
        );
    }

    @Operation(summary = "WBS 활동 로그 조회")
    @GetMapping("/{wbsItemId}/activities")
    public ResponseEntity<List<WbsActivityResponse>> getWbsActivities(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId
    ) {
        return ResponseEntity.ok(
            workItemHistoryService
                .getWbsActivities(jwt.getSubject(), teamId, projectId, wbsItemId)
                .stream()
                .map(WbsActivityResponse::from)
                .toList()
        );
    }

    @Operation(summary = "WBS에 문서 연결")
    @PutMapping("/{wbsItemId}/documents/{documentId}")
    public ResponseEntity<WbsDocumentResponse> linkDocument(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId,
        @Parameter(description = "문서 ID") @PathVariable Long documentId
    ) {
        return ResponseEntity.ok(
            WbsDocumentResponse.from(
                wbsDocumentService.linkDocument(jwt.getSubject(), teamId, projectId, wbsItemId, documentId)
            )
        );
    }

    @Operation(summary = "WBS에서 문서 연결 해제")
    @DeleteMapping("/{wbsItemId}/documents/{documentId}")
    public ResponseEntity<Void> unlinkDocument(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId,
        @Parameter(description = "문서 ID") @PathVariable Long documentId
    ) {
        wbsDocumentService.unlinkDocument(jwt.getSubject(), teamId, projectId, wbsItemId, documentId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "프로젝트 문서 태그 목록 조회")
    @GetMapping("/document-tags")
    public ResponseEntity<List<WbsDocumentTagResponse>> getDocumentTags(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            wbsDocumentService
                .getDocumentTags(jwt.getSubject(), teamId, projectId)
                .stream()
                .map(WbsDocumentTagResponse::from)
                .toList()
        );
    }

    @Operation(summary = "태그별 프로젝트 문서 조회")
    @GetMapping("/document-tags/documents")
    public ResponseEntity<List<WbsDocumentResponse>> getDocumentsByTag(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "조회할 태그") @org.springframework.web.bind.annotation.RequestParam String tag
    ) {
        return ResponseEntity.ok(
            wbsDocumentService
                .getDocumentsByTag(jwt.getSubject(), teamId, projectId, tag)
                .stream()
                .map(WbsDocumentResponse::from)
                .toList()
        );
    }

    @Operation(summary = "WBS 항목 생성")
    @ApiResponse(
        responseCode = "201",
        description = "생성 성공",
        content = @Content(schema = @Schema(implementation = WbsItemResponse.class))
    )
    @PostMapping
    public ResponseEntity<WbsItemResponse> createWbsItem(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody CreateWbsItemRequest request
    ) {
        final var command = new WbsService.CreateWbsItemCommand(
            request.parentId(),
            request.name(),
            request.assigneeUserId(),
            request.startDate(),
            request.endDate(),
            request.actualStartDate(),
            request.actualEndDate(),
            request.progressRate(),
            request.estimatedMm(),
            request.milestoneId()
        );
        final var result = wbsService.createWbsItem(jwt.getSubject(), teamId, projectId, command);
        return ResponseEntity.status(HttpStatus.CREATED).body(WbsItemResponse.from(result));
    }

    @Operation(summary = "WBS 항목 수정")
    @PutMapping("/{wbsItemId}")
    public ResponseEntity<WbsItemResponse> updateWbsItem(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId,
        @Valid @RequestBody UpdateWbsItemRequest request
    ) {
        final var result = wbsService.updateWbsItem(
            jwt.getSubject(),
            teamId,
            projectId,
            wbsItemId,
            request.name(),
            request.assigneeUserId(),
            request.startDate(),
            request.endDate(),
            request.actualStartDate(),
            request.actualEndDate(),
            request.progressRate(),
            request.estimatedMm(),
            request.milestoneId()
        );
        return ResponseEntity.ok(WbsItemResponse.from(result));
    }

    @Operation(summary = "WBS 항목 삭제")
    @DeleteMapping("/{wbsItemId}")
    public ResponseEntity<Void> deleteWbsItem(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId
    ) {
        wbsService.deleteWbsItem(jwt.getSubject(), teamId, projectId, wbsItemId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "WBS 순서/부모 변경")
    @PatchMapping("/reorder")
    public ResponseEntity<List<WbsItemResponse>> reorderWbsItems(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody ReorderWbsItemsRequest request
    ) {
        final var commands = request
            .items()
            .stream()
            .map((item) -> new WbsService.WbsReorderCommand(item.id(), item.parentId(), item.sortOrder()))
            .toList();

        return ResponseEntity.ok(
            wbsService
                .reorderWbsItems(jwt.getSubject(), teamId, projectId, commands)
                .stream()
                .map(WbsItemResponse::from)
                .toList()
        );
    }
}
