package com.smarterd.api.diagram;

import com.smarterd.api.diagram.dto.CreateDiagramRequest;
import com.smarterd.api.diagram.dto.DiagramDetailResponse;
import com.smarterd.api.diagram.dto.DiagramResponse;
import com.smarterd.api.diagram.dto.RenameDiagramRequest;
import com.smarterd.api.diagram.dto.SaveDiagramRequest;
import com.smarterd.domain.diagram.service.DiagramService;
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
 * 다이어그램 관련 REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/projects/{projectId}/diagrams} 경로 하위에
 * 다이어그램 CRUD 엔드포인트를 제공한다. 모든 엔드포인트는 인증이 필요하다.</p>
 */
@Tag(name = "Diagram", description = "다이어그램 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/diagrams")
@RequiredArgsConstructor
public class DiagramController {

    /** 다이어그램 비즈니스 로직 서비스 */
    private final DiagramService diagramService;

    /**
     * 다이어그램을 생성한다.
     *
     * @param jwt       인증된 JWT 토큰
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param request   다이어그램 생성 요청
     * @return 201 Created + DiagramResponse
     */
    @Operation(summary = "다이어그램 생성", description = "프로젝트 내에 새 다이어그램을 생성한다. 팀 멤버만 가능.")
    @ApiResponse(
        responseCode = "201",
        description = "다이어그램 생성 성공",
        content = @Content(schema = @Schema(implementation = DiagramResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청", content = @Content)
    @PostMapping
    public ResponseEntity<DiagramResponse> createDiagram(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody CreateDiagramRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            diagramService.createDiagram(jwt.getSubject(), teamId, projectId, request)
        );
    }

    /**
     * 프로젝트의 다이어그램 목록을 조회한다.
     *
     * @param jwt       인증된 JWT 토큰
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 200 OK + 다이어그램 목록
     */
    @Operation(summary = "다이어그램 목록 조회", description = "프로젝트에 속한 모든 다이어그램 목록을 반환한다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "프로젝트 미존재 또는 접근 권한 없음")
    @GetMapping
    public ResponseEntity<List<DiagramResponse>> getDiagrams(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(diagramService.getDiagrams(jwt.getSubject(), teamId, projectId));
    }

    /**
     * 다이어그램 상세를 조회한다 (content 포함).
     *
     * @param jwt        인증된 JWT 토큰
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @return 200 OK + DiagramDetailResponse
     */
    @Operation(summary = "다이어그램 상세 조회", description = "다이어그램 ID로 상세 정보를 조회한다 (content 포함).")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "다이어그램 미존재 또는 접근 권한 없음")
    @GetMapping("/{diagramId}")
    public ResponseEntity<DiagramDetailResponse> getDiagram(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId
    ) {
        return ResponseEntity.ok(diagramService.getDiagram(jwt.getSubject(), teamId, projectId, diagramId));
    }

    /**
     * 다이어그램 콘텐츠를 저장한다.
     *
     * @param jwt        인증된 JWT 토큰
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    저장 요청 (content)
     * @return 200 OK + DiagramDetailResponse
     */
    @Operation(summary = "다이어그램 저장", description = "다이어그램의 콘텐츠(노드·엣지 JSON)를 저장한다.")
    @ApiResponse(responseCode = "200", description = "저장 성공")
    @ApiResponse(responseCode = "400", description = "다이어그램 미존재 또는 접근 권한 없음")
    @PutMapping("/{diagramId}")
    public ResponseEntity<DiagramDetailResponse> saveDiagram(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @Valid @RequestBody SaveDiagramRequest request
    ) {
        return ResponseEntity.ok(diagramService.saveDiagram(jwt.getSubject(), teamId, projectId, diagramId, request));
    }

    /**
     * 다이어그램 이름을 변경한다.
     *
     * @param jwt        인증된 JWT 토큰
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    이름 변경 요청
     * @return 200 OK + DiagramResponse
     */
    @Operation(summary = "다이어그램 이름 변경", description = "다이어그램의 이름을 변경한다.")
    @ApiResponse(responseCode = "200", description = "이름 변경 성공")
    @ApiResponse(responseCode = "400", description = "다이어그램 미존재 또는 접근 권한 없음")
    @PatchMapping("/{diagramId}")
    public ResponseEntity<DiagramResponse> renameDiagram(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @Valid @RequestBody RenameDiagramRequest request
    ) {
        return ResponseEntity.ok(diagramService.renameDiagram(jwt.getSubject(), teamId, projectId, diagramId, request));
    }

    /**
     * 다이어그램을 삭제한다.
     *
     * @param jwt        인증된 JWT 토큰
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @return 204 No Content
     */
    @Operation(summary = "다이어그램 삭제", description = "다이어그램을 삭제한다. 팀 멤버만 가능.")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "400", description = "다이어그램 미존재 또는 접근 권한 없음")
    @DeleteMapping("/{diagramId}")
    public ResponseEntity<Void> deleteDiagram(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId
    ) {
        diagramService.deleteDiagram(jwt.getSubject(), teamId, projectId, diagramId);
        return ResponseEntity.noContent().build();
    }
}
