package com.smarterd.api.dictionary;

import com.smarterd.api.dictionary.dto.BulkDomainSaveRequest;
import com.smarterd.api.dictionary.dto.BulkSaveResponse;
import com.smarterd.api.dictionary.dto.BulkValidationResponse;
import com.smarterd.api.dictionary.dto.BulkValidationRow;
import com.smarterd.domain.dictionary.service.BulkModels.BulkSaveResult;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationResult;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationRowResult;
import com.smarterd.domain.dictionary.service.DomainBulkService;
import com.smarterd.domain.dictionary.service.DomainDictionaryExportService;
import com.smarterd.utils.ExcelUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 도메인 일괄 업로드와 엑셀 다운로드 REST 컨트롤러.
 */
@Tag(name = "Domain Bulk", description = "도메인 일괄 업로드와 엑셀 다운로드 API")
@RestController
@RequestMapping("/api/teams/{teamId}/dictionary-sets/{setId}/domains")
@RequiredArgsConstructor
public class DomainBulkController {

    private final DomainBulkService domainBulkService;
    private final DomainDictionaryExportService domainDictionaryExportService;

    /**
     * 업로드 파일에서 도메인 데이터를 검증한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @param setId  사전 세트 ID
     * @param file   업로드 파일
     * @param locale 요청 로케일
     * @return 검증 결과 응답
     */
    @Operation(summary = "도메인 업로드 검증", description = "엑셀/CSV 파일의 도메인 데이터를 검증한다.")
    @ApiResponse(responseCode = "200", description = "검증 완료")
    @ApiResponse(responseCode = "400", description = "지원하지 않는 형식 또는 빈 파일", content = @Content)
    @PostMapping("/upload/validate")
    public ResponseEntity<BulkValidationResponse> validateUpload(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @RequestParam("file") MultipartFile file,
        Locale locale
    ) {
        return ResponseEntity.ok(
            toBulkValidationResponse(domainBulkService.validateUpload(jwt.getSubject(), teamId, setId, file, locale))
        );
    }

    /**
     * 검증 통과한 도메인을 일괄 저장한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param request 일괄 저장 요청
     * @return 저장 결과 응답
     */
    @Operation(summary = "도메인 일괄 저장", description = "검증 통과한 도메인을 일괄 저장한다.")
    @ApiResponse(responseCode = "200", description = "저장 완료")
    @ApiResponse(responseCode = "400", description = "검증 토큰이 무효/만료되었거나 요청이 잘못됨", content = @Content)
    @PostMapping("/upload")
    public ResponseEntity<BulkSaveResponse> bulkSave(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Valid @RequestBody BulkDomainSaveRequest request
    ) {
        return ResponseEntity.ok(
            toBulkSaveResponse(
                domainBulkService.bulkSave(
                    jwt.getSubject(),
                    teamId,
                    setId,
                    request.validationToken(),
                    request.excludedRowNumbers()
                )
            )
        );
    }

    /**
     * 업로드 검증 오류 행을 엑셀로 다운로드한다.
     *
     * @param jwt             인증된 JWT 토큰
     * @param teamId          팀 ID
     * @param setId           사전 세트 ID
     * @param validationToken 검증 세션 토큰
     * @param locale          요청 로케일
     * @param response        HTTP 응답
     * @throws IOException 엑셀 생성 실패 시
     */
    @Operation(
        summary = "도메인 업로드 오류 엑셀 다운로드",
        description = "도메인 업로드 검증 오류 행을 엑셀로 다운로드한다."
    )
    @ApiResponse(responseCode = "200", description = "오류 엑셀 다운로드 성공")
    @ApiResponse(responseCode = "400", description = "검증 토큰이 무효/만료되었거나 요청이 잘못됨", content = @Content)
    @GetMapping("/upload/errors")
    public void downloadErrorReport(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "검증 세션 토큰") @RequestParam("validationToken") String validationToken,
        Locale locale,
        HttpServletResponse response
    ) throws IOException {
        final var excelData = domainBulkService.generateErrorReport(
            jwt.getSubject(),
            teamId,
            setId,
            validationToken,
            Objects.requireNonNull(locale)
        );
        ExcelUtils.download(excelData, response, "domain-upload-errors");
    }

    /**
     * 도메인 템플릿 엑셀을 다운로드한다.
     *
     * @param jwt      인증된 JWT 토큰
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param locale   요청 로케일
     * @param response HTTP 응답
     * @throws IOException 엑셀 생성 실패 시
     */
    @Operation(summary = "도메인 템플릿 다운로드", description = "도메인 일괄 업로드용 엑셀 템플릿을 다운로드한다.")
    @ApiResponse(responseCode = "200", description = "템플릿 다운로드 성공")
    @GetMapping("/upload/template")
    public void downloadTemplate(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        Locale locale,
        HttpServletResponse response
    ) throws IOException {
        final var excelData = domainBulkService.generateTemplate(
            jwt.getSubject(),
            teamId,
            setId,
            Objects.requireNonNull(locale)
        );
        ExcelUtils.download(excelData, response, "domain-template");
    }

    /**
     * 도메인 사전 엑셀을 다운로드한다.
     *
     * @param jwt      인증된 JWT 토큰
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param response HTTP 응답
     * @throws IOException 엑셀 생성 실패 시
     */
    @Operation(
        summary = "도메인 사전 엑셀 다운로드",
        description = "현재 사전 세트의 도메인 사전을 엑셀로 다운로드한다."
    )
    @ApiResponse(responseCode = "200", description = "도메인 사전 다운로드 성공")
    @GetMapping("/download/excel")
    public void downloadDomainDictionary(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        HttpServletResponse response
    ) throws IOException {
        final var excelData = domainDictionaryExportService.generateDomainDictionary(jwt.getSubject(), teamId, setId);
        ExcelUtils.download(excelData, response);
    }

    /**
     * 서비스 계층 벌크 검증 결과를 HTTP 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 결과
     * @return HTTP 응답 DTO
     */
    private BulkValidationResponse toBulkValidationResponse(BulkValidationResult result) {
        return new BulkValidationResponse(
            result.validationToken(),
            result.totalCount(),
            result.validCount(),
            result.errorCount(),
            result.previewTruncated(),
            result.rows().stream().map(this::toBulkValidationRow).toList()
        );
    }

    /**
     * 서비스 계층 벌크 검증 행을 HTTP 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 결과 행
     * @return HTTP 응답 DTO
     */
    private BulkValidationRow toBulkValidationRow(BulkValidationRowResult result) {
        return new BulkValidationRow(result.rowNumber(), result.valid(), result.errors(), result.data());
    }

    /**
     * 서비스 계층 벌크 저장 결과를 HTTP 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 결과
     * @return HTTP 응답 DTO
     */
    private BulkSaveResponse toBulkSaveResponse(BulkSaveResult result) {
        return new BulkSaveResponse(result.savedCount(), result.failedCount());
    }
}
