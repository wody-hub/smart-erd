package com.smarterd.api.project;

import com.smarterd.api.project.dto.CreateProjectRequest;
import com.smarterd.api.project.dto.ProjectResponse;
import com.smarterd.domain.project.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 프로젝트 관련 REST 컨트롤러.
 *
 * <p>{@code /api/teams/{teamId}/projects} 경로 하위에 프로젝트 CRUD 엔드포인트를 제공한다.
 * 모든 엔드포인트는 인증이 필요하다.</p>
 */
@Tag(name = "Project", description = "프로젝트 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects")
@RequiredArgsConstructor
public class ProjectController {

    /** 프로젝트 비즈니스 로직 서비스 */
    private final ProjectService projectService;

    /**
     * 프로젝트를 생성한다.
     *
     * @param jwt     인증된 JWT 토큰
     * @param teamId  팀 ID
     * @param request 프로젝트 생성 요청
     * @return 201 Created + ProjectResponse
     */
    @Operation(summary = "프로젝트 생성", description = "팀 내에 새 프로젝트를 생성한다. 팀 멤버만 가능.")
    @ApiResponse(
        responseCode = "201",
        description = "프로젝트 생성 성공",
        content = @Content(schema = @Schema(implementation = ProjectResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청 (팀 미존재, 멤버 아님 등)", content = @Content)
    @PostMapping
    public ResponseEntity<ProjectResponse> createProject(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Valid @RequestBody CreateProjectRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            projectService.createProject(jwt.getSubject(), teamId, request)
        );
    }

    /**
     * 팀의 프로젝트 목록을 조회한다.
     *
     * @param jwt    인증된 JWT 토큰
     * @param teamId 팀 ID
     * @return 200 OK + 프로젝트 목록
     */
    @Operation(summary = "프로젝트 목록 조회", description = "팀에 속한 모든 프로젝트 목록을 반환한다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "팀이 존재하지 않거나 접근 권한 없음")
    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getProjects(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId
    ) {
        return ResponseEntity.ok(projectService.getProjects(jwt.getSubject(), teamId));
    }

    /**
     * 프로젝트 상세를 조회한다.
     *
     * @param jwt       인증된 JWT 토큰
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 200 OK + ProjectResponse
     */
    @Operation(summary = "프로젝트 상세 조회", description = "프로젝트 ID로 상세 정보를 조회한다.")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "프로젝트 미존재 또는 접근 권한 없음")
    @GetMapping("/{projectId}")
    public ResponseEntity<ProjectResponse> getProject(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(projectService.getProject(jwt.getSubject(), teamId, projectId));
    }

    /**
     * 프로젝트를 삭제한다.
     *
     * @param jwt       인증된 JWT 토큰
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 204 No Content
     */
    @Operation(summary = "프로젝트 삭제", description = "프로젝트를 삭제한다. 팀 멤버만 가능.")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "400", description = "프로젝트 미존재 또는 접근 권한 없음")
    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> deleteProject(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        projectService.deleteProject(jwt.getSubject(), teamId, projectId);
        return ResponseEntity.noContent().build();
    }
}
