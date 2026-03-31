package com.smarterd.api.dictionary;

import com.smarterd.api.dictionary.dto.CreateDictionarySetRequest;
import com.smarterd.api.dictionary.dto.DictionarySetResponse;
import com.smarterd.api.dictionary.dto.UpdateDictionarySetRequest;
import com.smarterd.domain.dictionary.service.DictionarySetExportService;
import com.smarterd.domain.dictionary.service.DictionarySetService;
import com.smarterd.domain.dictionary.service.DictionarySetService.DictionarySetResult;
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
 * 사전 세트 관리 REST 컨트롤러.
 */
@Tag(name = "Dictionary Set", description = "사전 세트 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/dictionary-sets")
@RequiredArgsConstructor
public class DictionarySetController {

    /** 사전 세트 도메인 서비스 */
    private final DictionarySetService dictionarySetService;

    /** 사전 세트 일괄 엑셀 내보내기 서비스 */
    private final DictionarySetExportService dictionarySetExportService;

    /**
     * 사전 세트를 생성한다.
     *
     * @param jwt 인증된 사용자 JWT
     * @param teamId 팀 ID
     * @param request 사전 세트 생성 요청
     * @return 생성된 사전 세트 응답
     */
    @Operation(summary = "사전 세트 생성")
    @ApiResponse(
        responseCode = "201",
        description = "생성 성공",
        content = @Content(schema = @Schema(implementation = DictionarySetResponse.class))
    )
    @PostMapping
    public ResponseEntity<DictionarySetResponse> createDictionarySet(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Valid @RequestBody CreateDictionarySetRequest request
    ) {
        final var result = dictionarySetService.createDictionarySet(
            jwt.getSubject(),
            teamId,
            request.name(),
            request.description()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(toDictionarySetResponse(result));
    }

    /**
     * 팀의 사전 세트 목록을 조회한다.
     *
     * @param jwt 인증된 사용자 JWT
     * @param teamId 팀 ID
     * @return 사전 세트 목록 응답
     */
    @Operation(summary = "사전 세트 목록 조회")
    @GetMapping
    public ResponseEntity<List<DictionarySetResponse>> getDictionarySets(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId
    ) {
        return ResponseEntity.ok(
            dictionarySetService
                .getDictionarySets(jwt.getSubject(), teamId)
                .stream()
                .map(this::toDictionarySetResponse)
                .toList()
        );
    }

    /**
     * 사전 세트 단건을 조회한다.
     *
     * @param jwt 인증된 사용자 JWT
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 사전 세트 단건 응답
     */
    @Operation(summary = "사전 세트 단건 조회")
    @GetMapping("/{setId}")
    public ResponseEntity<DictionarySetResponse> getDictionarySet(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "세트 ID") @PathVariable Long setId
    ) {
        return ResponseEntity.ok(
            toDictionarySetResponse(dictionarySetService.getDictionarySet(jwt.getSubject(), teamId, setId))
        );
    }

    /**
     * 사전 세트를 수정한다.
     *
     * @param jwt 인증된 사용자 JWT
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param request 사전 세트 수정 요청
     * @return 수정된 사전 세트 응답
     */
    @Operation(summary = "사전 세트 수정")
    @PutMapping("/{setId}")
    public ResponseEntity<DictionarySetResponse> updateDictionarySet(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "세트 ID") @PathVariable Long setId,
        @Valid @RequestBody UpdateDictionarySetRequest request
    ) {
        return ResponseEntity.ok(
            toDictionarySetResponse(
                dictionarySetService.updateDictionarySet(
                    jwt.getSubject(),
                    teamId,
                    setId,
                    request.name(),
                    request.description()
                )
            )
        );
    }

    /**
     * 사전 세트를 삭제한다.
     *
     * @param jwt 인증된 사용자 JWT
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 본문 없는 204 응답
     */
    @Operation(summary = "사전 세트 삭제")
    @DeleteMapping("/{setId}")
    public ResponseEntity<Void> deleteDictionarySet(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "세트 ID") @PathVariable Long setId
    ) {
        dictionarySetService.deleteDictionarySet(jwt.getSubject(), teamId, setId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 기본 사전 세트를 지정한다.
     *
     * @param jwt 인증된 사용자 JWT
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 기본 사전 세트로 지정된 응답
     */
    @Operation(summary = "기본 사전 세트 지정")
    @PatchMapping("/{setId}/default")
    public ResponseEntity<DictionarySetResponse> setDefaultDictionarySet(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "세트 ID") @PathVariable Long setId
    ) {
        return ResponseEntity.ok(
            toDictionarySetResponse(dictionarySetService.setDefaultDictionarySet(jwt.getSubject(), teamId, setId))
        );
    }

    /**
     * 사전 세트의 단어·용어·도메인 전체를 하나의 엑셀 파일(3시트)로 다운로드한다.
     *
     * @param jwt      인증된 JWT 토큰
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param response HTTP 응답
     * @throws IOException 엑셀 쓰기 실패 시
     */
    @Operation(summary = "사전 세트 전체 엑셀 다운로드 (단어 + 용어 + 도메인)")
    @ApiResponse(
        responseCode = "200",
        description = "엑셀 파일",
        content = @Content(mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    )
    @GetMapping("/{setId}/download/excel")
    public void downloadAllDictionary(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        HttpServletResponse response
    ) throws IOException {
        final var excelData = dictionarySetExportService.generateAllDictionary(jwt.getSubject(), teamId, setId);
        ExcelUtils.download(excelData, response);
    }

    /**
     * 서비스 계층 사전 세트 결과를 HTTP 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 결과
     * @return HTTP 응답 DTO
     */
    private DictionarySetResponse toDictionarySetResponse(DictionarySetResult result) {
        return new DictionarySetResponse(
            result.id(),
            result.name(),
            result.description(),
            result.teamId(),
            result.isDefault(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
