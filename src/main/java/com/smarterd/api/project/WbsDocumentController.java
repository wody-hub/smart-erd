package com.smarterd.api.project;

import com.smarterd.api.project.dto.wbs.WbsDocumentResponse;
import com.smarterd.api.project.dto.wbs.WbsDocumentTagResponse;
import com.smarterd.domain.pm.wbs.service.WbsDocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * WBS 연결 문서 REST 컨트롤러.
 */
@Tag(name = "WBS Documents", description = "WBS 연결 문서 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/wbs")
@RequiredArgsConstructor
public class WbsDocumentController {

    private final WbsDocumentService wbsDocumentService;

    /**
     * WBS에 연결된 문서를 조회한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param wbsItemId WBS 항목 ID
     * @return 연결 문서 목록
     */
    @Operation(summary = "WBS 연결 문서 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
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

    /**
     * WBS 항목에 문서를 연결한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param wbsItemId WBS 항목 ID
     * @param documentId 문서 ID
     * @return 연결된 문서
     */
    @Operation(summary = "WBS에 문서 연결")
    @ApiResponse(responseCode = "200", description = "연결 성공")
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

    /**
     * WBS 항목에서 문서 연결을 해제한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param wbsItemId WBS 항목 ID
     * @param documentId 문서 ID
     * @return 빈 응답
     */
    @Operation(summary = "WBS에서 문서 연결 해제")
    @ApiResponse(responseCode = "204", description = "연결 해제 성공")
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

    /**
     * 프로젝트 문서 태그 목록을 조회한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @return 문서 태그 목록
     */
    @Operation(summary = "프로젝트 문서 태그 목록 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
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

    /**
     * 태그로 프로젝트 문서를 조회한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param tag 조회할 태그
     * @return 태그가 일치하는 문서 목록
     */
    @Operation(summary = "태그별 프로젝트 문서 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @GetMapping("/document-tags/documents")
    public ResponseEntity<List<WbsDocumentResponse>> getDocumentsByTag(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "조회할 태그") @RequestParam String tag
    ) {
        return ResponseEntity.ok(
            wbsDocumentService
                .getDocumentsByTag(jwt.getSubject(), teamId, projectId, tag)
                .stream()
                .map(WbsDocumentResponse::from)
                .toList()
        );
    }
}
