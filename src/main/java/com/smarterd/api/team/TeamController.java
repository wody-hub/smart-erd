package com.smarterd.api.team;

import com.smarterd.api.team.dto.CreateTeamRequest;
import com.smarterd.api.team.dto.MyRoleResponse;
import com.smarterd.api.team.dto.TeamResponse;
import com.smarterd.api.team.dto.UpdateTeamRequest;
import com.smarterd.domain.team.service.TeamService;
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
 * 팀 관련 REST 컨트롤러.
 *
 * <p>{@code /api/teams} 경로 하위에 팀 CRUD 및 멤버 관리 엔드포인트를 제공한다.
 * 모든 엔드포인트는 인증이 필요하며, JWT 토큰의 subject(loginId)로 요청 사용자를 식별한다.</p>
 */
@Tag(name = "Team", description = "팀 관리 API")
@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    /** 팀 비즈니스 로직 서비스 */
    private final TeamService teamService;

    /**
     * 새 팀을 생성한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param request 팀 생성 요청
     * @return 201 Created + TeamResponse
     */
    @Operation(summary = "팀 생성", description = "새 팀을 생성한다. 요청 사용자가 소유자(owner) 겸 ADMIN이 된다.")
    @ApiResponse(
        responseCode = "201",
        description = "팀 생성 성공",
        content = @Content(schema = @Schema(implementation = TeamResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청", content = @Content)
    @PostMapping
    public ResponseEntity<TeamResponse> createTeam(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody CreateTeamRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(teamService.createTeam(jwt.getSubject(), request));
    }

    /**
     * 내가 속한 팀 목록을 조회한다.
     *
     * @param jwt 인증된 JWT 토큰
     * @return 200 OK + 팀 목록
     */
    @Operation(summary = "내 팀 목록 조회", description = "요청 사용자가 속한 모든 팀 목록을 반환한다.")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = TeamResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청", content = @Content)
    @GetMapping
    public ResponseEntity<List<TeamResponse>> getMyTeams(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(teamService.getMyTeams(jwt.getSubject()));
    }

    /**
     * 현재 사용자의 팀 내 역할을 조회한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @return 200 OK + MyRoleResponse
     */
    @Operation(summary = "내 역할 조회", description = "현재 사용자의 팀 내 역할을 조회한다.")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = MyRoleResponse.class))
    )
    @ApiResponse(responseCode = "403", description = "팀 멤버가 아님", content = @Content)
    @ApiResponse(responseCode = "404", description = "팀 미존재", content = @Content)
    @GetMapping("/{teamId}/me")
    public ResponseEntity<MyRoleResponse> getMyRole(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId
    ) {
        return ResponseEntity.ok(teamService.getMyRole(jwt.getSubject(), teamId));
    }

    /**
     * 팀 이름을 변경한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param request 팀 수정 요청
     * @return 200 OK + TeamResponse
     */
    @Operation(summary = "팀 이름 변경", description = "팀 이름을 변경한다. ADMIN 권한 필요.")
    @ApiResponse(
        responseCode = "200",
        description = "변경 성공",
        content = @Content(schema = @Schema(implementation = TeamResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "유효성 검증 실패", content = @Content)
    @ApiResponse(responseCode = "403", description = "ADMIN 아님", content = @Content)
    @ApiResponse(responseCode = "404", description = "팀 미존재", content = @Content)
    @PutMapping("/{teamId}")
    public ResponseEntity<TeamResponse> updateTeam(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Valid @RequestBody UpdateTeamRequest request
    ) {
        return ResponseEntity.ok(teamService.updateTeam(jwt.getSubject(), teamId, request));
    }

    /**
     * 팀을 삭제한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @return 204 No Content
     */
    @Operation(summary = "팀 삭제", description = "팀과 모든 하위 리소스를 삭제한다. ADMIN 권한 필요.")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "403", description = "ADMIN 아님", content = @Content)
    @ApiResponse(responseCode = "404", description = "팀 미존재", content = @Content)
    @DeleteMapping("/{teamId}")
    public ResponseEntity<Void> deleteTeam(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId
    ) {
        teamService.deleteTeam(jwt.getSubject(), teamId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 팀 상세를 조회한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @return 200 OK + TeamResponse
     */
    @Operation(summary = "팀 상세 조회", description = "팀 ID로 팀 상세 정보를 조회한다. 팀 멤버만 접근 가능.")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = TeamResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "팀이 존재하지 않거나 접근 권한 없음", content = @Content)
    @GetMapping("/{teamId}")
    public ResponseEntity<TeamResponse> getTeam(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId
    ) {
        return ResponseEntity.ok(teamService.getTeam(jwt.getSubject(), teamId));
    }
}
