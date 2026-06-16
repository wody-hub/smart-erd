package com.smarterd.api.dictionary;

import com.smarterd.api.common.dto.PageResponse;
import com.smarterd.api.dictionary.dto.CreateWordRequest;
import com.smarterd.api.dictionary.dto.UpdateWordRequest;
import com.smarterd.api.dictionary.dto.WordResponse;
import com.smarterd.domain.dictionary.service.WordResult;
import com.smarterd.domain.dictionary.service.WordService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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

/**
 * 단어 사전 REST 컨트롤러.
 */
@Tag(name = "Word", description = "단어 사전 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/dictionary-sets/{setId}/words")
@RequiredArgsConstructor
public class WordController {

    private final WordService wordService;

    @Operation(summary = "단어 생성")
    @ApiResponse(
        responseCode = "201",
        description = "단어 생성 성공",
        content = @Content(schema = @Schema(implementation = WordResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청", content = @Content)
    @ApiResponse(responseCode = "409", description = "논리명 중복", content = @Content)
    @PostMapping
    public ResponseEntity<WordResponse> createWord(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Valid @RequestBody CreateWordRequest request
    ) {
        final var result = wordService.createWord(
            jwt.getSubject(),
            teamId,
            setId,
            request.logicalName(),
            request.physicalName(),
            request.description()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(toWordResponse(result));
    }

    @Operation(summary = "단어 목록 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "팀 또는 사전 세트가 존재하지 않거나 접근 권한 없음")
    @GetMapping
    public ResponseEntity<PageResponse<WordResponse>> getWords(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "페이지 번호 (0-base)") @RequestParam(defaultValue = "0") int page,
        @Parameter(description = "페이지 크기 (최대 200)") @RequestParam(defaultValue = "20") int size,
        @Parameter(description = "복합 검색어 (논리명/물리명/설명)") @RequestParam(
            required = false,
            name = "q"
        ) String keyword
    ) {
        final var resultPage = wordService
            .getWords(jwt.getSubject(), teamId, setId, page, size, keyword)
            .map(this::toWordResponse);
        return ResponseEntity.ok(PageResponse.from(resultPage));
    }

    @Operation(summary = "단어 상세 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "단어 미존재 또는 접근 권한 없음")
    @GetMapping("/{wordId}")
    public ResponseEntity<WordResponse> getWord(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "단어 ID") @PathVariable Long wordId
    ) {
        return ResponseEntity.ok(toWordResponse(wordService.getWord(jwt.getSubject(), teamId, setId, wordId)));
    }

    @Operation(summary = "단어 수정")
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400", description = "잘못된 요청")
    @ApiResponse(responseCode = "409", description = "논리명 중복")
    @PutMapping("/{wordId}")
    public ResponseEntity<WordResponse> updateWord(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "단어 ID") @PathVariable Long wordId,
        @Valid @RequestBody UpdateWordRequest request
    ) {
        return ResponseEntity.ok(
            toWordResponse(
                wordService.updateWord(
                    jwt.getSubject(),
                    teamId,
                    setId,
                    wordId,
                    request.logicalName(),
                    request.physicalName(),
                    request.description()
                )
            )
        );
    }

    @Operation(summary = "단어 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "400", description = "단어 미존재 또는 접근 권한 없음")
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

    /**
     * 서비스 계층 단어 결과를 HTTP 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 결과
     * @return HTTP 응답 DTO
     */
    private WordResponse toWordResponse(WordResult result) {
        return new WordResponse(
            result.id(),
            result.logicalName(),
            result.physicalName(),
            result.description(),
            result.teamId(),
            result.dictionarySetId(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
