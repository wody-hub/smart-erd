package com.smarterd.api.dictionary;

import com.smarterd.api.common.dto.PageResponse;
import com.smarterd.api.common.dto.PageSearchRequest;
import com.smarterd.api.dictionary.dto.BulkSaveResponse;
import com.smarterd.api.dictionary.dto.BulkValidationResponse;
import com.smarterd.api.dictionary.dto.BulkWordSaveRequest;
import com.smarterd.api.dictionary.dto.CreateWordRequest;
import com.smarterd.api.dictionary.dto.UpdateWordRequest;
import com.smarterd.api.dictionary.dto.WordResponse;
import com.smarterd.domain.dictionary.service.WordBulkService;
import com.smarterd.domain.dictionary.service.WordService;
import com.smarterd.utils.ExcelUtils;
import jakarta.servlet.http.HttpServletResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.Locale;
import java.util.Objects;
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
 * 단어 사전 REST 컨트롤러.
 */
@Tag(name = "Word", description = "단어 사전 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/dictionary-sets/{setId}/words")
@RequiredArgsConstructor
public class WordController {

    private final WordService wordService;
    private final WordBulkService wordBulkService;

    @Operation(summary = "단어 생성")
    @ApiResponse(
        responseCode = "201",
        description = "단어 생성 성공",
        content = @Content(schema = @Schema(implementation = WordResponse.class))
    )
    @PostMapping
    public ResponseEntity<WordResponse> createWord(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Valid @RequestBody CreateWordRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            wordService.createWord(jwt.getSubject(), teamId, setId, request)
        );
    }

    @Operation(summary = "단어 목록 조회")
    @GetMapping
    public ResponseEntity<PageResponse<WordResponse>> getWords(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "페이지 번호 (0-base)") @RequestParam(defaultValue = "0") int page,
        @Parameter(description = "페이지 크기 (최대 200)") @RequestParam(defaultValue = "20") int size,
        @Parameter(description = "복합 검색어 (논리명/물리명/설명)") @RequestParam(required = false, name = "q") String keyword
    ) {
        final var searchRequest = new PageSearchRequest(page, size, keyword);
        return ResponseEntity.ok(wordService.getWords(jwt.getSubject(), teamId, setId, searchRequest));
    }

    @Operation(summary = "단어 업로드 검증", description = "엑셀/CSV 파일의 단어 데이터를 검증한다.")
    @PostMapping("/upload/validate")
    public ResponseEntity<BulkValidationResponse> validateUpload(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @RequestParam("file") MultipartFile file,
        Locale locale
    ) {
        return ResponseEntity.ok(wordBulkService.validateUpload(jwt.getSubject(), teamId, setId, file, locale));
    }

    @Operation(summary = "단어 일괄 저장", description = "검증 통과한 단어를 일괄 저장한다.")
    @PostMapping("/upload")
    public ResponseEntity<BulkSaveResponse> bulkSave(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Valid @RequestBody BulkWordSaveRequest request
    ) {
        return ResponseEntity.ok(wordBulkService.bulkSave(jwt.getSubject(), teamId, setId, request));
    }

    @Operation(summary = "단어 업로드 오류 엑셀 다운로드", description = "단어 업로드 검증 오류 행을 엑셀로 다운로드한다.")
    @GetMapping("/upload/errors")
    public void downloadErrorReport(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "검증 세션 토큰") @RequestParam("validationToken") String validationToken,
        Locale locale,
        HttpServletResponse response
    ) throws IOException {
        final var excelData = wordBulkService.generateErrorReport(
            jwt.getSubject(),
            teamId,
            setId,
            validationToken,
            Objects.requireNonNull(locale)
        );
        ExcelUtils.download(excelData, response, "word-upload-errors");
    }

    @Operation(summary = "단어 템플릿 다운로드", description = "단어 일괄 업로드용 엑셀 템플릿을 다운로드한다.")
    @GetMapping("/upload/template")
    public void downloadTemplate(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        Locale locale,
        HttpServletResponse response
    ) throws IOException {
        final var excelData = wordBulkService.generateTemplate(
            jwt.getSubject(),
            teamId,
            setId,
            Objects.requireNonNull(locale)
        );
        ExcelUtils.download(excelData, response, "word-template");
    }

    @Operation(summary = "단어 상세 조회")
    @GetMapping("/{wordId}")
    public ResponseEntity<WordResponse> getWord(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "단어 ID") @PathVariable Long wordId
    ) {
        return ResponseEntity.ok(wordService.getWord(jwt.getSubject(), teamId, setId, wordId));
    }

    @Operation(summary = "단어 수정")
    @PutMapping("/{wordId}")
    public ResponseEntity<WordResponse> updateWord(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "단어 ID") @PathVariable Long wordId,
        @Valid @RequestBody UpdateWordRequest request
    ) {
        return ResponseEntity.ok(wordService.updateWord(jwt.getSubject(), teamId, setId, wordId, request));
    }

    @Operation(summary = "단어 삭제")
    @DeleteMapping("/{wordId}")
    public ResponseEntity<Void> deleteWord(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "단어 ID") @PathVariable Long wordId
    ) {
        wordService.deleteWord(jwt.getSubject(), teamId, setId, wordId);
        return ResponseEntity.noContent().build();
    }
}
