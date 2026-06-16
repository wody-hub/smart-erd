package com.smarterd.api.diagram;

import com.smarterd.api.diagram.dto.DiagramResponse;
import com.smarterd.api.diagram.dto.RenameDiagramRequest;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetRequest;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetResponse;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.DiagramSummaryResult;
import com.smarterd.domain.diagram.service.DictionarySetChangeResult;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 다이어그램 변경 REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/projects/{projectId}/diagrams} 경로 하위에서
 * 이름 변경, 사전 세트 변경, 삭제 엔드포인트를 제공한다.</p>
 */
@Tag(name = "Diagram Mutation", description = "다이어그램 변경 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/diagrams")
@RequiredArgsConstructor
public class DiagramMutationController {

    /** 다이어그램 비즈니스 로직 서비스 */
    private final DiagramService diagramService;

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
        return ResponseEntity.ok(
            toDiagramResponse(
                diagramService.renameDiagram(jwt.getSubject(), teamId, projectId, diagramId, request.name())
            )
        );
    }

    /**
     * 다이어그램 사전 세트를 변경한다.
     *
     * @param jwt        인증된 JWT 토큰
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    사전 세트 변경 요청
     * @return 200 OK + 변경 결과
     */
    @Operation(summary = "다이어그램 사전 세트 변경", description = "다이어그램에 적용된 사전 세트를 변경한다.")
    @ApiResponse(
        responseCode = "200",
        description = "사전 세트 변경 성공",
        content = @Content(schema = @Schema(implementation = UpdateDiagramDictionarySetResponse.class))
    )
    @ApiResponse(responseCode = "403", description = "VIEWER 권한으로 변경 불가", content = @Content)
    @PatchMapping("/{diagramId}/dictionary-set")
    public ResponseEntity<UpdateDiagramDictionarySetResponse> updateDictionarySet(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @Valid @RequestBody UpdateDiagramDictionarySetRequest request
    ) {
        return ResponseEntity.ok(
            toUpdateDiagramDictionarySetResponse(
                diagramService.updateDiagramDictionarySet(
                    jwt.getSubject(),
                    teamId,
                    projectId,
                    diagramId,
                    request.dictionarySetId()
                )
            )
        );
    }

    /**
     * 다이어그램을 논리 삭제한다.
     *
     * @param jwt        인증된 JWT 토큰
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @return 204 No Content
     */
    @Operation(
        summary = "다이어그램 삭제",
        description = "다이어그램을 논리 삭제한다. 삭제된 다이어그램은 목록/상세 조회에서 제외된다."
    )
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

    /**
     * 서비스 계층 목록 결과를 API 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 목록 결과
     * @return API 목록 응답 DTO
     */
    private DiagramResponse toDiagramResponse(DiagramSummaryResult result) {
        return new DiagramResponse(
            result.id(),
            result.name(),
            result.pluginId(),
            result.projectId(),
            result.dictionarySetId(),
            result.dictionarySetName(),
            result.templateKey(),
            result.templateLabel(),
            result.summaryText(),
            result.createdAt(),
            result.updatedAt()
        );
    }

    /**
     * 서비스 계층 사전 세트 변경 결과를 API 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 사전 세트 변경 결과
     * @return API 사전 세트 변경 응답 DTO
     */
    private UpdateDiagramDictionarySetResponse toUpdateDiagramDictionarySetResponse(DictionarySetChangeResult result) {
        return new UpdateDiagramDictionarySetResponse(
            result.dictionarySetId(),
            result.invalidatedTermBindingCount(),
            result.invalidatedDomainBindingCount()
        );
    }
}
