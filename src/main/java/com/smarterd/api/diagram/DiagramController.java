package com.smarterd.api.diagram;

import com.smarterd.api.diagram.dto.CreateDiagramRequest;
import com.smarterd.api.diagram.dto.DiagramDetailResponse;
import com.smarterd.api.diagram.dto.DiagramResponse;
import com.smarterd.api.diagram.dto.ExportDiagramWorkbookRequest;
import com.smarterd.api.diagram.dto.PersistYdocSnapshotRequest;
import com.smarterd.api.diagram.dto.PersistYdocSnapshotResponse;
import com.smarterd.api.diagram.dto.RenameDiagramRequest;
import com.smarterd.api.diagram.dto.SaveDiagramRequest;
import com.smarterd.api.diagram.dto.SaveDiagramResponse;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetRequest;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetResponse;
import com.smarterd.application.diagram.command.PersistDiagramSnapshotUseCase;
import com.smarterd.application.diagram.command.SaveDiagramUseCase;
import com.smarterd.domain.diagram.service.DiagramColumnDefinitionExportService;
import com.smarterd.domain.diagram.service.DiagramIndexDefinitionExportService;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.DiagramTableDefinitionExportService;
import com.smarterd.domain.diagram.service.DiagramService.DictionarySetChangeResult;
import com.smarterd.domain.diagram.service.DiagramService.DiagramDetailResult;
import com.smarterd.domain.diagram.service.DiagramService.DiagramSummaryResult;
import com.smarterd.domain.diagram.service.DiagramService.SaveDiagramResult;
import com.smarterd.utils.ExcelUtils;
import jakarta.servlet.http.HttpServletResponse;
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

    /** authoritative 다이어그램 저장 유스케이스 */
    private final SaveDiagramUseCase saveDiagramUseCase;

    /** 협업 snapshot 저장 유스케이스 */
    private final PersistDiagramSnapshotUseCase persistDiagramSnapshotUseCase;

    /** 다이어그램 테이블 정의서 엑셀 export 서비스 */
    private final DiagramTableDefinitionExportService diagramTableDefinitionExportService;

    /** 다이어그램 컬럼 정의서 엑셀 export 서비스 */
    private final DiagramColumnDefinitionExportService diagramColumnDefinitionExportService;

    /** 다이어그램 인덱스 정의서 엑셀 export 서비스 */
    private final DiagramIndexDefinitionExportService diagramIndexDefinitionExportService;

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
        final var result = diagramService.createDiagram(
            jwt.getSubject(),
            teamId,
            projectId,
            request.name(),
            request.dictionarySetId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(toDiagramResponse(result));
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
        return ResponseEntity.ok(
            diagramService.getDiagrams(jwt.getSubject(), teamId, projectId).stream().map(this::toDiagramResponse).toList()
        );
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
        return ResponseEntity.ok(toDiagramDetailResponse(diagramService.getDiagram(jwt.getSubject(), teamId, projectId, diagramId)));
    }

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
        return ResponseEntity.ok(toSaveDiagramResponse(
            saveDiagramUseCase.execute(
                jwt.getSubject(),
                teamId,
                projectId,
                diagramId,
                request.content(),
                request.ydocSnapshot()
            )
        ));
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
                    request.ydocSnapshot()
                )
            )
        );
    }

    /**
     * 다이어그램의 테이블 정의서 엑셀을 다운로드한다.
     *
     * @param jwt 인증된 JWT 토큰
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param request 현재 캔버스 기준 직렬화 JSON
     * @param response HTTP 응답
     * @throws java.io.IOException 다운로드 오류 발생 시
     */
    @Operation(summary = "테이블 정의서 엑셀 다운로드", description = "현재 다이어그램 기준 테이블 정의서 엑셀을 다운로드한다.")
    @ApiResponse(responseCode = "200", description = "다운로드 성공")
    @PostMapping("/{diagramId}/table-definition")
    public void downloadTableDefinition(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @RequestBody(required = false) ExportDiagramWorkbookRequest request,
        HttpServletResponse response
    ) throws java.io.IOException {
        final var excelData = diagramTableDefinitionExportService.generateTableDefinition(
            jwt.getSubject(),
            teamId,
            projectId,
            diagramId,
            request != null ? request.content() : null
        );
        ExcelUtils.download(excelData, response);
    }

    /**
     * 다이어그램의 컬럼 정의서 엑셀을 다운로드한다.
     *
     * @param jwt 인증된 JWT 토큰
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param request 현재 캔버스 기준 직렬화 JSON
     * @param response HTTP 응답
     * @throws java.io.IOException 다운로드 오류 발생 시
     */
    @Operation(summary = "컬럼 정의서 엑셀 다운로드", description = "현재 다이어그램 기준 컬럼 정의서 엑셀을 다운로드한다.")
    @ApiResponse(responseCode = "200", description = "다운로드 성공")
    @PostMapping("/{diagramId}/column-definition")
    public void downloadColumnDefinition(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @RequestBody(required = false) ExportDiagramWorkbookRequest request,
        HttpServletResponse response
    ) throws java.io.IOException {
        final var excelData = diagramColumnDefinitionExportService.generateColumnDefinition(
            jwt.getSubject(),
            teamId,
            projectId,
            diagramId,
            request != null ? request.content() : null
        );
        ExcelUtils.download(excelData, response);
    }

    /**
     * 다이어그램의 인덱스 정의서 엑셀을 다운로드한다.
     *
     * @param jwt 인증된 JWT 토큰
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param request 현재 캔버스 기준 직렬화 JSON
     * @param response HTTP 응답
     * @throws java.io.IOException 다운로드 오류 발생 시
     */
    @Operation(summary = "인덱스 정의서 엑셀 다운로드", description = "현재 다이어그램 기준 인덱스 정의서 엑셀을 다운로드한다.")
    @ApiResponse(responseCode = "200", description = "다운로드 성공")
    @PostMapping("/{diagramId}/index-definition")
    public void downloadIndexDefinition(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @RequestBody(required = false) ExportDiagramWorkbookRequest request,
        HttpServletResponse response
    ) throws java.io.IOException {
        final var excelData = diagramIndexDefinitionExportService.generateIndexDefinition(
            jwt.getSubject(),
            teamId,
            projectId,
            diagramId,
            request != null ? request.content() : null
        );
        ExcelUtils.download(excelData, response);
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
        return ResponseEntity.ok(
            toDiagramResponse(diagramService.renameDiagram(jwt.getSubject(), teamId, projectId, diagramId, request.name()))
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
    @PatchMapping("/{diagramId}/dictionary-set")
    public ResponseEntity<UpdateDiagramDictionarySetResponse> updateDictionarySet(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @Valid @RequestBody UpdateDiagramDictionarySetRequest request
    ) {
        return ResponseEntity.ok(toUpdateDiagramDictionarySetResponse(
            diagramService.updateDiagramDictionarySet(
                jwt.getSubject(),
                teamId,
                projectId,
                diagramId,
                request.dictionarySetId()
            )
        ));
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
    @Operation(summary = "다이어그램 삭제", description = "다이어그램을 논리 삭제한다. 삭제된 다이어그램은 목록/상세 조회에서 제외된다.")
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
            result.projectId(),
            result.dictionarySetId(),
            result.dictionarySetName(),
            result.createdAt(),
            result.updatedAt()
        );
    }

    /**
     * 서비스 계층 상세 결과를 API 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 상세 결과
     * @return API 상세 응답 DTO
     */
    private DiagramDetailResponse toDiagramDetailResponse(DiagramDetailResult result) {
        return new DiagramDetailResponse(
            result.id(),
            result.name(),
            result.projectId(),
            result.dictionarySetId(),
            result.dictionarySetName(),
            result.content(),
            result.hasYdocSnapshot(),
            String.valueOf(result.contentRevision()),
            result.snapshotRevision() != null ? String.valueOf(result.snapshotRevision()) : null,
            result.snapshotUpdatedAt(),
            result.createdAt(),
            result.updatedAt()
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

    /**
     * 서비스 계층 사전 세트 변경 결과를 API 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 사전 세트 변경 결과
     * @return API 사전 세트 변경 응답 DTO
     */
    private UpdateDiagramDictionarySetResponse toUpdateDiagramDictionarySetResponse(
        DictionarySetChangeResult result
    ) {
        return new UpdateDiagramDictionarySetResponse(
            result.dictionarySetId(),
            result.invalidatedTermBindingCount(),
            result.invalidatedDomainBindingCount()
        );
    }
}
