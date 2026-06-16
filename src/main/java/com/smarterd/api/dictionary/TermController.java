package com.smarterd.api.dictionary;

import com.smarterd.api.common.dto.PageResponse;
import com.smarterd.api.dictionary.dto.CreateTermRequest;
import com.smarterd.api.dictionary.dto.TermResponse;
import com.smarterd.api.dictionary.dto.UpdateTermRequest;
import com.smarterd.domain.dictionary.service.TermService;
import com.smarterd.domain.dictionary.service.TermService.TermResult;
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
 * 용어(이름 사전) 관련 REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/dictionary-sets/{setId}/terms} 경로 하위에 용어 CRUD 엔드포인트를 제공한다.
 * 모든 엔드포인트는 인증이 필요하다.</p>
 */
@Tag(name = "Term", description = "용어(이름 사전) 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/dictionary-sets/{setId}/terms")
@RequiredArgsConstructor
public class TermController {

    /** 용어 비즈니스 로직 서비스 */
    private final TermService termService;

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
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Valid @RequestBody CreateTermRequest request
    ) {
        final var result = termService.createTerm(
            jwt.getSubject(),
            teamId,
            setId,
            request.logicalName(),
            request.physicalName(),
            request.domainId(),
            request.description()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(toTermResponse(result));
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
    public ResponseEntity<PageResponse<TermResponse>> getTerms(
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
        final var resultPage = termService
            .getTerms(jwt.getSubject(), teamId, setId, page, size, keyword)
            .map(this::toTermResponse);
        return ResponseEntity.ok(PageResponse.from(resultPage));
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
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "용어 ID") @PathVariable Long termId
    ) {
        return ResponseEntity.ok(toTermResponse(termService.getTerm(jwt.getSubject(), teamId, setId, termId)));
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
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "용어 ID") @PathVariable Long termId,
        @Valid @RequestBody UpdateTermRequest request
    ) {
        return ResponseEntity.ok(
            toTermResponse(
                termService.updateTerm(
                    jwt.getSubject(),
                    teamId,
                    setId,
                    termId,
                    request.logicalName(),
                    request.physicalName(),
                    request.domainId(),
                    request.description()
                )
            )
        );
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
        @Parameter(description = "사전 세트 ID") @PathVariable Long setId,
        @Parameter(description = "용어 ID") @PathVariable Long termId
    ) {
        termService.deleteTerm(jwt.getSubject(), teamId, setId, termId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 서비스 계층 용어 결과를 HTTP 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 결과
     * @return HTTP 응답 DTO
     */
    private TermResponse toTermResponse(TermResult result) {
        return new TermResponse(
            result.id(),
            result.logicalName(),
            result.physicalName(),
            result.description(),
            result.teamId(),
            result.dictionarySetId(),
            result.domainId(),
            result.domainLogicalName(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
