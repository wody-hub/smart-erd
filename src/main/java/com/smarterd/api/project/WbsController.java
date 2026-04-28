package com.smarterd.api.project;

import com.smarterd.api.project.dto.wbs.CreateWbsItemRequest;
import com.smarterd.api.project.dto.wbs.ReorderWbsItemsRequest;
import com.smarterd.api.project.dto.wbs.UpdateWbsItemRequest;
import com.smarterd.api.project.dto.wbs.WbsDocumentResponse;
import com.smarterd.api.project.dto.wbs.WbsDocumentTagResponse;
import com.smarterd.api.project.dto.wbs.WbsItemResponse;
import com.smarterd.domain.pm.wbs.service.WbsDocumentService;
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
    private final WbsDocumentService wbsDocumentService;

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
