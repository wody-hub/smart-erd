package com.smarterd.api.dictionary;

import com.smarterd.api.dictionary.dto.SuggestMatch;
import com.smarterd.api.dictionary.dto.SuggestRequest;
import com.smarterd.api.dictionary.dto.SuggestResponse;
import com.smarterd.domain.dictionary.service.DictionarySuggestService;
import com.smarterd.domain.dictionary.service.DictionarySuggestService.SuggestMatchResult;
import com.smarterd.domain.dictionary.service.DictionarySuggestService.SuggestResult;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 키워드 기반 물리명/도메인 추천 REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/dictionary-sets/{setId}/dictionary/suggest} 경로에 추천 엔드포인트를 제공한다.
 * 모든 엔드포인트는 인증이 필요하다.</p>
 */
@Tag(name = "Dictionary Suggest", description = "키워드 기반 물리명/도메인 추천 API")
@RestController
@RequestMapping("/api/teams/{teamId}/dictionary-sets/{setId}/dictionary")
@RequiredArgsConstructor
public class DictionarySuggestController {

    /** 키워드 추천 서비스 */
    private final DictionarySuggestService dictionarySuggestService;

    /**
     * 한글 키워드에서 물리명과 도메인을 추천한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param request 추천 요청
     * @return 200 OK + 추천 결과
     */
    @Operation(summary = "키워드 추천", description = "한글 키워드를 기반으로 물리명과 도메인을 추천한다.")
    @ApiResponse(
        responseCode = "200",
        description = "추천 성공",
        content = @Content(schema = @Schema(implementation = SuggestResponse.class))
    )
    @ApiResponse(responseCode = "403", description = "팀 미소속", content = @Content)
    @PostMapping("/suggest")
    public ResponseEntity<SuggestResponse> suggest(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Valid @RequestBody SuggestRequest request
    ) {
        return ResponseEntity.ok(
            toSuggestResponse(dictionarySuggestService.suggest(jwt.getSubject(), teamId, setId, request.keyword()))
        );
    }

    /**
     * 서비스 계층 추천 결과를 HTTP 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 결과
     * @return HTTP 응답 DTO
     */
    private SuggestResponse toSuggestResponse(SuggestResult result) {
        return new SuggestResponse(
            result.physicalName(),
            result.domainId(),
            result.domainLogicalName(),
            result.matches().stream().map(this::toSuggestMatch).toList()
        );
    }

    /**
     * 서비스 계층 토큰 매칭 결과를 HTTP 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 결과
     * @return HTTP 응답 DTO
     */
    private SuggestMatch toSuggestMatch(SuggestMatchResult result) {
        return new SuggestMatch(result.token(), result.matched(), result.physicalName(), result.matchType());
    }
}
