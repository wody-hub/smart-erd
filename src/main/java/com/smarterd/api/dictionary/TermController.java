package com.smarterd.api.dictionary;

import com.smarterd.api.dictionary.dto.BulkSaveResponse;
import com.smarterd.api.dictionary.dto.BulkTermSaveRequest;
import com.smarterd.api.dictionary.dto.BulkValidationResponse;
import com.smarterd.api.dictionary.dto.CreateTermRequest;
import com.smarterd.api.dictionary.dto.TermResponse;
import com.smarterd.api.dictionary.dto.UpdateTermRequest;
import com.smarterd.domain.dictionary.service.TermBulkService;
import com.smarterd.domain.dictionary.service.TermService;
import com.smarterd.utils.ExcelUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 용어(이름 사전) 관련 REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/terms} 경로 하위에 용어 CRUD 엔드포인트를 제공한다.
 * 모든 엔드포인트는 인증이 필요하다.</p>
 */
@Tag(name = "Term", description = "용어(이름 사전) 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/terms")
@RequiredArgsConstructor
public class TermController {

    /** 용어 비즈니스 로직 서비스 */
    private final TermService termService;

    /** 용어 일괄 업로드 서비스 */
    private final TermBulkService termBulkService;

    /**
     * 용어를 생성한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param request 용어 생성 요청
     * @return 201 Created + TermResponse
     */
    @Operation(summary = "용어 생성", description = "팀 내에 새 용어를 생성한다. 팀 멤버만 가능.")
    @ApiResponse(
        responseCode = "201",
        description = "용어 생성 성공",
        content = @Content(schema = @Schema(implementation = TermResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청", content = @Content)
    @ApiResponse(responseCode = "409", description = "논리명 중복", content = @Content)
    @PostMapping
    public ResponseEntity<TermResponse> createTerm(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Valid @RequestBody CreateTermRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            termService.createTerm(jwt.getSubject(), teamId, request)
        );
    }

    /**
     * 팀의 용어 목록을 조회한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @return 200 OK + 용어 목록
     */
    @Operation(summary = "용어 목록 조회", description = "팀에 속한 모든 용어 목록을 반환한다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "팀이 존재하지 않거나 접근 권한 없음")
    @GetMapping
    public ResponseEntity<List<TermResponse>> getTerms(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId
    ) {
        return ResponseEntity.ok(termService.getTerms(jwt.getSubject(), teamId));
    }

    /**
     * 용어 상세를 조회한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @param termId 용어 ID
     * @return 200 OK + TermResponse
     */
    @Operation(summary = "용어 상세 조회", description = "용어 ID로 상세 정보를 조회한다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "용어 미존재 또는 접근 권한 없음")
    @GetMapping("/{termId}")
    public ResponseEntity<TermResponse> getTerm(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "용어 ID") @PathVariable Long termId
    ) {
        return ResponseEntity.ok(termService.getTerm(jwt.getSubject(), teamId, termId));
    }

    /**
     * 용어를 수정한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param termId  용어 ID
     * @param request 용어 수정 요청
     * @return 200 OK + TermResponse
     */
    @Operation(summary = "용어 수정", description = "용어 정보를 수정한다. 팀 멤버만 가능.")
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400", description = "잘못된 요청")
    @ApiResponse(responseCode = "409", description = "논리명 중복")
    @PutMapping("/{termId}")
    public ResponseEntity<TermResponse> updateTerm(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "용어 ID") @PathVariable Long termId,
        @Valid @RequestBody UpdateTermRequest request
    ) {
        return ResponseEntity.ok(termService.updateTerm(jwt.getSubject(), teamId, termId, request));
    }

    /**
     * 업로드 파일에서 용어 데이터를 검증한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @param file   업로드 파일 (.xlsx 또는 .csv)
     * @return 200 OK + 검증 결과
     */
    @Operation(summary = "용어 업로드 검증", description = "엑셀/CSV 파일의 용어 데이터를 검증한다.")
    @ApiResponse(responseCode = "200", description = "검증 완료")
    @ApiResponse(responseCode = "400", description = "지원하지 않는 형식 또는 빈 파일", content = @Content)
    @PostMapping("/upload/validate")
    public ResponseEntity<BulkValidationResponse> validateUpload(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @RequestParam("file") MultipartFile file,
        Locale locale
    ) {
        return ResponseEntity.ok(termBulkService.validateUpload(jwt.getSubject(), teamId, file, locale));
    }

    /**
     * 검증 통과한 용어를 일괄 저장한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param request 일괄 저장 요청
     * @return 200 OK + 저장 결과
     */
    @Operation(summary = "용어 일괄 저장", description = "검증 통과한 용어를 일괄 저장한다.")
    @ApiResponse(responseCode = "200", description = "저장 완료")
    @ApiResponse(responseCode = "400", description = "빈 rows 배열", content = @Content)
    @PostMapping("/upload")
    public ResponseEntity<BulkSaveResponse> bulkSave(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Valid @RequestBody BulkTermSaveRequest request
    ) {
        return ResponseEntity.ok(termBulkService.bulkSave(jwt.getSubject(), teamId, request));
    }

    /**
     * 용어 템플릿 엑셀을 다운로드한다.
     *
     * @param jwt      인증된 JWT 토큰
     * @param teamId   팀 ID
     * @param locale   요청 로케일 (Accept-Language 헤더에서 해석)
     * @param response HTTP 응답
     * @throws IOException 엑셀 생성 실패 시
     */
    @Operation(summary = "용어 템플릿 다운로드", description = "용어 일괄 업로드용 엑셀 템플릿을 다운로드한다.")
    @ApiResponse(responseCode = "200", description = "템플릿 다운로드 성공")
    @GetMapping("/upload/template")
    public void downloadTemplate(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        Locale locale,
        HttpServletResponse response
    ) throws IOException {
        final var excelData = termBulkService.generateTemplate(jwt.getSubject(), teamId, locale);
        ExcelUtils.download(excelData, response, "term-template");
    }

    /**
     * 용어를 삭제한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @param termId 용어 ID
     * @return 204 No Content
     */
    @Operation(summary = "용어 삭제", description = "용어를 삭제한다. 팀 멤버만 가능.")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "400", description = "용어 미존재 또는 접근 권한 없음")
    @DeleteMapping("/{termId}")
    public ResponseEntity<Void> deleteTerm(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "용어 ID") @PathVariable Long termId
    ) {
        termService.deleteTerm(jwt.getSubject(), teamId, termId);
        return ResponseEntity.noContent().build();
    }
}
