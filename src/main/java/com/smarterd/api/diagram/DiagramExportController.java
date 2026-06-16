package com.smarterd.api.diagram;

import com.smarterd.api.diagram.dto.ExportDiagramWorkbookRequest;
import com.smarterd.api.diagram.dto.ExportDocumentRequest;
import com.smarterd.domain.diagram.service.DiagramColumnDefinitionExportService;
import com.smarterd.domain.diagram.service.DiagramIndexDefinitionExportService;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.DiagramTableDefinitionExportService;
import com.smarterd.domain.markdown.service.MarkdownExportService;
import com.smarterd.utils.ExcelUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 다이어그램 산출물 export REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/projects/{projectId}/diagrams} 경로 하위에서
 * Excel 정의서와 markdown 원문 export 엔드포인트를 제공한다.</p>
 */
@Tag(name = "Diagram Export", description = "다이어그램 산출물 export API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/diagrams")
@RequiredArgsConstructor
public class DiagramExportController {

    /** 다이어그램 테이블 정의서 엑셀 export 서비스 */
    private final DiagramTableDefinitionExportService diagramTableDefinitionExportService;

    /** 다이어그램 컬럼 정의서 엑셀 export 서비스 */
    private final DiagramColumnDefinitionExportService diagramColumnDefinitionExportService;

    /** 다이어그램 인덱스 정의서 엑셀 export 서비스 */
    private final DiagramIndexDefinitionExportService diagramIndexDefinitionExportService;

    /** 다이어그램 조회 서비스 */
    private final DiagramService diagramService;

    /** markdown export 서비스 */
    private final MarkdownExportService markdownExportService;

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
    @Operation(
        summary = "테이블 정의서 엑셀 다운로드",
        description = "현재 다이어그램 기준 테이블 정의서 엑셀을 다운로드한다."
    )
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
    @Operation(
        summary = "컬럼 정의서 엑셀 다운로드",
        description = "현재 다이어그램 기준 컬럼 정의서 엑셀을 다운로드한다."
    )
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
    @Operation(
        summary = "인덱스 정의서 엑셀 다운로드",
        description = "현재 다이어그램 기준 인덱스 정의서 엑셀을 다운로드한다."
    )
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
     * 문서를 markdown 원문 포맷으로 export 한다.
     *
     * @param jwt 인증 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 문서 ID
     * @param request export 요청
     * @param response HTTP 응답
     * @throws java.io.IOException 응답 스트림 쓰기 실패
     */
    @Operation(summary = "문서 export", description = "markdown 문서를 원문 md 파일로 export 한다.")
    @ApiResponse(responseCode = "200", description = "export 성공")
    @PostMapping("/{diagramId}/exports")
    public void exportDocument(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "다이어그램 ID") @PathVariable Long diagramId,
        @Valid @RequestBody ExportDocumentRequest request,
        HttpServletResponse response
    ) throws java.io.IOException {
        final var diagram = diagramService.loadReadableDiagram(jwt.getSubject(), teamId, projectId, diagramId);
        final var exportResult = markdownExportService.export(diagram, request.format());
        response.setContentType(exportResult.contentType());
        final var encodedName = java.net.URLEncoder.encode(
            exportResult.fileName(),
            java.nio.charset.StandardCharsets.UTF_8
        ).replace("+", "%20");
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodedName);
        response.getOutputStream().write(exportResult.body());
    }
}
