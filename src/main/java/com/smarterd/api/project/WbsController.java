package com.smarterd.api.project;

import com.smarterd.api.project.dto.wbs.CreateWbsItemRequest;
import com.smarterd.api.project.dto.wbs.ReorderWbsItemsRequest;
import com.smarterd.api.project.dto.wbs.UpdateWbsItemRequest;
import com.smarterd.api.project.dto.wbs.WbsItemResponse;
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

    @Operation(summary = "WBS 트리 조회")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = WbsItemResponse.class))
    )
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
    @ApiResponse(
        responseCode = "200",
        description = "수정 성공",
        content = @Content(schema = @Schema(implementation = WbsItemResponse.class))
    )
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
    @ApiResponse(responseCode = "204", description = "삭제 성공", content = @Content)
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
    @ApiResponse(
        responseCode = "200",
        description = "순서/부모 변경 성공",
        content = @Content(schema = @Schema(implementation = WbsItemResponse.class))
    )
    @PatchMapping("/order")
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
