package com.smarterd.api.team;

import com.smarterd.api.team.dto.AddMemberRequest;
import com.smarterd.api.team.dto.CreateTeamRequest;
import com.smarterd.api.team.dto.TeamMemberResponse;
import com.smarterd.api.team.dto.TeamResponse;
import com.smarterd.api.team.dto.UpdateMemberRoleRequest;
import com.smarterd.api.team.validator.AddMemberRequestValidator;
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
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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

    /** 멤버 추가 요청 유효성 검사기 */
    private final AddMemberRequestValidator addMemberRequestValidator;

    /**
     * 커스텀 Validator를 등록한다.
     *
     * @param binder 웹 데이터 바인더
     */
    @InitBinder
    public void initBinder(WebDataBinder binder) {
        binder.addValidators(addMemberRequestValidator);
    }

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

    /**
     * 팀 멤버 목록을 조회한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @return 200 OK + 멤버 목록
     */
    @Operation(summary = "팀 멤버 목록 조회", description = "팀에 속한 모든 멤버 목록을 반환한다.")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = TeamMemberResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "팀이 존재하지 않거나 접근 권한 없음", content = @Content)
    @GetMapping("/{teamId}/members")
    public ResponseEntity<List<TeamMemberResponse>> getMembers(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId
    ) {
        return ResponseEntity.ok(teamService.getMembers(jwt.getSubject(), teamId));
    }

    /**
     * 팀에 멤버를 초대한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param request 멤버 추가 요청
     * @return 201 Created + TeamMemberResponse
     */
    @Operation(summary = "멤버 초대", description = "팀에 새 멤버를 초대한다. ADMIN 권한 필요.")
    @ApiResponse(
        responseCode = "201",
        description = "초대 성공",
        content = @Content(schema = @Schema(implementation = TeamMemberResponse.class))
    )
    @ApiResponse(
        responseCode = "400",
        description = "잘못된 요청 (권한 없음, 이미 멤버, 사용자 미존재 등)",
        content = @Content
    )
    @PostMapping("/{teamId}/members")
    public ResponseEntity<TeamMemberResponse> addMember(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Valid @RequestBody AddMemberRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(teamService.addMember(jwt.getSubject(), teamId, request));
    }

    /**
     * 팀에서 멤버를 제거한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @param userId 제거할 사용자 ID
     * @return 204 No Content
     */
    @Operation(summary = "멤버 제거", description = "팀에서 멤버를 제거한다. ADMIN 권한 필요. 소유자는 제거 불가.")
    @ApiResponse(responseCode = "204", description = "제거 성공")
    @ApiResponse(responseCode = "400", description = "잘못된 요청 (권한 없음, 소유자 제거 시도 등)", content = @Content)
    @DeleteMapping("/{teamId}/members/{userId}")
    public ResponseEntity<Void> removeMember(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "제거할 사용자 ID") @PathVariable Long userId
    ) {
        teamService.removeMember(jwt.getSubject(), teamId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 팀 멤버의 역할을 변경한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param userId  대상 사용자 ID
     * @param request 역할 변경 요청
     * @return 200 OK + TeamMemberResponse
     */
    @Operation(
        summary = "멤버 역할 변경",
        description = "팀 멤버의 역할을 변경한다. ADMIN 권한 필요. 소유자 역할 변경 불가."
    )
    @ApiResponse(
        responseCode = "200",
        description = "변경 성공",
        content = @Content(schema = @Schema(implementation = TeamMemberResponse.class))
    )
    @ApiResponse(
        responseCode = "400",
        description = "잘못된 요청 (권한 없음, 소유자 역할 변경 시도 등)",
        content = @Content
    )
    @PatchMapping("/{teamId}/members/{userId}")
    public ResponseEntity<TeamMemberResponse> updateMemberRole(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "대상 사용자 ID") @PathVariable Long userId,
        @Valid @RequestBody UpdateMemberRoleRequest request
    ) {
        return ResponseEntity.ok(teamService.updateMemberRole(jwt.getSubject(), teamId, userId, request));
    }
}
