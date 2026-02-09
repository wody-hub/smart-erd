package com.smarterd.api.dictionary;

import com.smarterd.api.dictionary.dto.CreateDomainRequest;
import com.smarterd.api.dictionary.dto.DomainResponse;
import com.smarterd.api.dictionary.dto.UpdateDomainRequest;
import com.smarterd.domain.dictionary.service.DomainService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 도메인(데이터 타입 사전) 관련 REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/domains} 경로 하위에 도메인 CRUD 엔드포인트를 제공한다.
 * 모든 엔드포인트는 인증이 필요하다.</p>
 */
@Tag(name = "Domain", description = "도메인(데이터 타입 사전) 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/domains")
@RequiredArgsConstructor
public class DomainController {

    /** 도메인 비즈니스 로직 서비스 */
    private final DomainService domainService;

    /**
     * 도메인을 생성한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param request 도메인 생성 요청
     * @return 201 Created + DomainResponse
     */
    @Operation(summary = "도메인 생성", description = "팀 내에 새 도메인을 생성한다. 팀 멤버만 가능.")
    @ApiResponse(
        responseCode = "201",
        description = "도메인 생성 성공",
        content = @Content(schema = @Schema(implementation = DomainResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청", content = @Content)
    @ApiResponse(responseCode = "409", description = "논리명 중복", content = @Content)
    @PostMapping
    public ResponseEntity<DomainResponse> createDomain(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Valid @RequestBody CreateDomainRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            domainService.createDomain(jwt.getSubject(), teamId, request)
        );
    }

    /**
     * 팀의 도메인 목록을 조회한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @return 200 OK + 도메인 목록
     */
    @Operation(summary = "도메인 목록 조회", description = "팀에 속한 모든 도메인 목록을 반환한다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "팀이 존재하지 않거나 접근 권한 없음")
    @GetMapping
    public ResponseEntity<List<DomainResponse>> getDomains(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId
    ) {
        return ResponseEntity.ok(domainService.getDomains(jwt.getSubject(), teamId));
    }

    /**
     * 도메인 상세를 조회한다.
     *
     * @param jwt      인증된 JWT 토큰
     * @param teamId   팀 ID
     * @param domainId 도메인 ID
     * @return 200 OK + DomainResponse
     */
    @Operation(summary = "도메인 상세 조회", description = "도메인 ID로 상세 정보를 조회한다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "도메인 미존재 또는 접근 권한 없음")
    @GetMapping("/{domainId}")
    public ResponseEntity<DomainResponse> getDomain(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "도메인 ID") @PathVariable Long domainId
    ) {
        return ResponseEntity.ok(domainService.getDomain(jwt.getSubject(), teamId, domainId));
    }

    /**
     * 도메인을 수정한다.
     *
     * @param jwt      인증된 JWT 토큰
     * @param teamId   팀 ID
     * @param domainId 도메인 ID
     * @param request  도메인 수정 요청
     * @return 200 OK + DomainResponse
     */
    @Operation(summary = "도메인 수정", description = "도메인 정보를 수정한다. 팀 멤버만 가능.")
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400", description = "잘못된 요청")
    @ApiResponse(responseCode = "409", description = "논리명 중복")
    @PutMapping("/{domainId}")
    public ResponseEntity<DomainResponse> updateDomain(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "도메인 ID") @PathVariable Long domainId,
        @Valid @RequestBody UpdateDomainRequest request
    ) {
        return ResponseEntity.ok(domainService.updateDomain(jwt.getSubject(), teamId, domainId, request));
    }

    /**
     * 도메인을 삭제한다.
     *
     * @param jwt      인증된 JWT 토큰
     * @param teamId   팀 ID
     * @param domainId 도메인 ID
     * @return 204 No Content
     */
    @Operation(summary = "도메인 삭제", description = "도메인을 삭제한다. 용어에서 참조 중이면 삭제 불가.")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "400", description = "도메인 미존재, 접근 권한 없음, 또는 참조 중")
    @DeleteMapping("/{domainId}")
    public ResponseEntity<Void> deleteDomain(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "도메인 ID") @PathVariable Long domainId
    ) {
        domainService.deleteDomain(jwt.getSubject(), teamId, domainId);
        return ResponseEntity.noContent().build();
    }
}
