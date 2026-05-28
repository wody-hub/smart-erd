package com.smarterd.api.settings;

import com.smarterd.api.settings.dto.ProjectWorkspaceTabOrderRequest;
import com.smarterd.api.settings.dto.ProjectWorkspaceTabOrderResponse;
import com.smarterd.domain.settings.service.UserSettingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사용자 설정 REST 컨트롤러.
 */
@Tag(name = "User Settings", description = "사용자별 개인화 설정 API")
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class UserSettingController {

    private final UserSettingService userSettingService;

    /**
     * 프로젝트 작업공간 탭 순서를 조회한다.
     *
     * @param jwt 인증된 JWT
     * @return 저장된 탭 순서
     */
    @Operation(
        summary = "프로젝트 작업공간 탭 순서 조회",
        description = "현재 로그인 사용자의 프로젝트 작업공간 탭 순서를 반환한다."
    )
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = ProjectWorkspaceTabOrderResponse.class))
    )
    @GetMapping("/project-workspace-tabs")
    public ResponseEntity<ProjectWorkspaceTabOrderResponse> getProjectWorkspaceTabOrder(
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(
            ProjectWorkspaceTabOrderResponse.from(userSettingService.getProjectWorkspaceTabOrder(jwt.getSubject()))
        );
    }

    /**
     * 프로젝트 작업공간 탭 순서를 저장한다.
     *
     * @param jwt 인증된 JWT
     * @param request 저장 요청
     * @return 저장된 탭 순서
     */
    @Operation(
        summary = "프로젝트 작업공간 탭 순서 저장",
        description = "현재 로그인 사용자의 프로젝트 작업공간 탭 순서를 저장한다."
    )
    @ApiResponse(
        responseCode = "200",
        description = "저장 성공",
        content = @Content(schema = @Schema(implementation = ProjectWorkspaceTabOrderResponse.class))
    )
    @PutMapping("/project-workspace-tabs")
    public ResponseEntity<ProjectWorkspaceTabOrderResponse> updateProjectWorkspaceTabOrder(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody ProjectWorkspaceTabOrderRequest request
    ) {
        return ResponseEntity.ok(
            ProjectWorkspaceTabOrderResponse.from(
                userSettingService.updateProjectWorkspaceTabOrder(jwt.getSubject(), request.tabOrder())
            )
        );
    }
}
