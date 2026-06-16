package com.smarterd.api.diagram;

import com.smarterd.api.diagram.dto.PersistYdocSnapshotRequest;
import com.smarterd.api.diagram.dto.PersistYdocSnapshotResponse;
import com.smarterd.api.diagram.dto.SaveDiagramRequest;
import com.smarterd.api.diagram.dto.SaveDiagramResponse;
import com.smarterd.application.diagram.command.PersistDiagramSnapshotUseCase;
import com.smarterd.application.diagram.command.SaveDiagramUseCase;
import com.smarterd.domain.diagram.service.SaveDiagramResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 다이어그램 콘텐츠 저장 REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/projects/{projectId}/diagrams} 경로 하위에서
 * authoritative content와 Y.Doc snapshot 저장 엔드포인트를 제공한다.</p>
 */
@Tag(name = "Diagram Content", description = "다이어그램 콘텐츠 저장 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/diagrams")
@RequiredArgsConstructor
public class DiagramContentController {

    /** authoritative 다이어그램 저장 유스케이스 */
    private final SaveDiagramUseCase saveDiagramUseCase;

    /** 협업 snapshot 저장 유스케이스 */
    private final PersistDiagramSnapshotUseCase persistDiagramSnapshotUseCase;

    /**
     * 다이어그램 콘텐츠를 저장한다.
     *
     * @param jwt        인증된 JWT 토큰
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    저장 요청 (content)
     * @return 200 OK + SaveDiagramResponse
     */
    @Operation(summary = "다이어그램 저장", description = "다이어그램의 콘텐츠(노드·엣지 JSON)를 저장한다.")
    @ApiResponse(
        responseCode = "200",
        description = "저장 성공",
        content = @Content(schema = @Schema(implementation = SaveDiagramResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "다이어그램 미존재 또는 접근 권한 없음")
    @PutMapping("/{diagramId}")
    public ResponseEntity<SaveDiagramResponse> saveDiagram(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @Valid @RequestBody SaveDiagramRequest request
    ) {
        return ResponseEntity.ok(
            toSaveDiagramResponse(
                saveDiagramUseCase.execute(
                    jwt.getSubject(),
                    teamId,
                    projectId,
                    diagramId,
                    request.content(),
                    request.ydocSnapshot()
                )
            )
        );
    }

    /**
     * 현재 Y.Doc 스냅샷을 즉시 영속화한다.
     *
     * @param jwt        인증된 JWT 토큰
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    Y.Doc 스냅샷 저장 요청
     * @return 200 OK + PersistYdocSnapshotResponse
     */
    @Operation(summary = "Y.Doc 스냅샷 즉시 저장", description = "클라이언트가 보낸 현재 Y.Doc 스냅샷을 즉시 저장한다.")
    @ApiResponse(
        responseCode = "200",
        description = "저장 성공",
        content = @Content(schema = @Schema(implementation = PersistYdocSnapshotResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "다이어그램 미존재 또는 접근 권한 없음")
    @PostMapping("/{diagramId}/ydoc-snapshot")
    public ResponseEntity<PersistYdocSnapshotResponse> persistYdocSnapshot(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @Valid @RequestBody PersistYdocSnapshotRequest request
    ) {
        return ResponseEntity.ok(
            new PersistYdocSnapshotResponse(
                persistDiagramSnapshotUseCase.execute(
                    jwt.getSubject(),
                    teamId,
                    projectId,
                    diagramId,
                    request.expectedContentRevision(),
                    request.ydocSnapshot(),
                    request.persistOnlyIfMissing()
                )
            )
        );
    }

    /**
     * 서비스 계층 저장 결과를 API 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 저장 결과
     * @return API 저장 응답 DTO
     */
    private SaveDiagramResponse toSaveDiagramResponse(SaveDiagramResult result) {
        return new SaveDiagramResponse(
            String.valueOf(result.contentRevision()),
            result.hasYdocSnapshot(),
            result.snapshotRevision() != null ? String.valueOf(result.snapshotRevision()) : null,
            result.snapshotUpdatedAt(),
            result.updatedAt()
        );
    }
}
