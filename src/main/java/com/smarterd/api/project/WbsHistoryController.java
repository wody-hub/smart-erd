package com.smarterd.api.project;

import com.smarterd.api.project.dto.wbs.CreateWbsCommentRequest;
import com.smarterd.api.project.dto.wbs.WbsActivityResponse;
import com.smarterd.api.project.dto.wbs.WbsCommentResponse;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
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
 * WBS 댓글과 활동 로그 REST 컨트롤러.
 */
@Tag(name = "WBS History", description = "WBS 댓글 및 활동 로그 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/wbs")
@RequiredArgsConstructor
public class WbsHistoryController {

    private final WorkItemHistoryService workItemHistoryService;

    /**
     * WBS 댓글 목록을 조회한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param wbsItemId WBS 항목 ID
     * @return WBS 댓글 목록
     */
    @Operation(summary = "WBS 댓글 목록 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
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

    /**
     * WBS 댓글을 작성한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param wbsItemId WBS 항목 ID
     * @param request 댓글 작성 요청
     * @return 작성된 WBS 댓글
     */
    @Operation(summary = "WBS 댓글 작성")
    @ApiResponse(responseCode = "201", description = "작성 성공")
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

    /**
     * WBS 활동 로그를 조회한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param wbsItemId WBS 항목 ID
     * @return WBS 활동 로그 목록
     */
    @Operation(summary = "WBS 활동 로그 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
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
}
