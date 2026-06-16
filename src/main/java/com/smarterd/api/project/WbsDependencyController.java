package com.smarterd.api.project;

import com.smarterd.api.project.dto.wbs.CreateWbsDependencyRequest;
import com.smarterd.api.project.dto.wbs.UpdateWbsDependencyRequest;
import com.smarterd.api.project.dto.wbs.WbsDependencyResponse;
import com.smarterd.api.project.dto.wbs.WbsDependencyShiftRequest;
import com.smarterd.api.project.dto.wbs.WbsDependencyShiftResponse;
import com.smarterd.domain.pm.wbs.service.WbsDependencyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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
 * WBS dependency REST 컨트롤러.
 */
@Tag(name = "WBS Dependencies", description = "WBS dependency 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/wbs")
@RequiredArgsConstructor
public class WbsDependencyController {

    private final WbsDependencyService wbsDependencyService;

    /**
     * 프로젝트 WBS dependency 목록을 조회한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @return WBS dependency 목록
     */
    @Operation(summary = "WBS dependency 목록 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @GetMapping("/dependencies")
    public ResponseEntity<List<WbsDependencyResponse>> getDependencies(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            wbsDependencyService
                .getDependencies(jwt.getSubject(), teamId, projectId)
                .stream()
                .map(WbsDependencyResponse::from)
                .toList()
        );
    }

    /**
     * WBS dependency 일정 전파 결과를 시뮬레이션한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param request 일정 전파 기준 요청
     * @return 일정 전파 시뮬레이션 결과
     */
    @Operation(summary = "WBS dependency shift preview")
    @ApiResponse(responseCode = "200", description = "시뮬레이션 성공")
    @PostMapping("/dependency-shift-simulations")
    public ResponseEntity<WbsDependencyShiftResponse> previewDependencyShift(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody WbsDependencyShiftRequest request
    ) {
        final var result = wbsDependencyService.previewShift(
            jwt.getSubject(),
            teamId,
            projectId,
            request
                .anchors()
                .stream()
                .map((anchor) ->
                    new WbsDependencyService.WbsDependencyShiftAnchorCommand(
                        anchor.wbsItemId(),
                        anchor.startDate(),
                        anchor.endDate()
                    )
                )
                .toList()
        );
        return ResponseEntity.ok(WbsDependencyShiftResponse.from(result));
    }

    /**
     * WBS dependency 일정 전파를 적용한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param request 일정 전파 기준 요청
     * @return 적용된 일정 전파 결과
     */
    @Operation(summary = "WBS dependency shift apply")
    @ApiResponse(responseCode = "200", description = "적용 성공")
    @PostMapping("/dependency-shifts")
    public ResponseEntity<WbsDependencyShiftResponse> applyDependencyShift(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody WbsDependencyShiftRequest request
    ) {
        final var result = wbsDependencyService.applyShift(
            jwt.getSubject(),
            teamId,
            projectId,
            request
                .anchors()
                .stream()
                .map((anchor) ->
                    new WbsDependencyService.WbsDependencyShiftAnchorCommand(
                        anchor.wbsItemId(),
                        anchor.startDate(),
                        anchor.endDate()
                    )
                )
                .toList()
        );
        return ResponseEntity.ok(WbsDependencyShiftResponse.from(result));
    }

    /**
     * WBS dependency를 생성한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param request dependency 생성 요청
     * @return 생성된 WBS dependency
     */
    @Operation(summary = "WBS dependency 생성")
    @ApiResponse(responseCode = "201", description = "생성 성공")
    @PostMapping("/dependencies")
    public ResponseEntity<WbsDependencyResponse> createDependency(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody CreateWbsDependencyRequest request
    ) {
        final var result = wbsDependencyService.createDependency(
            jwt.getSubject(),
            teamId,
            projectId,
            new WbsDependencyService.WbsDependencyCommand(
                request.predecessorWbsItemId(),
                request.successorWbsItemId(),
                request.dependencyType()
            )
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(WbsDependencyResponse.from(result));
    }

    /**
     * WBS dependency를 수정한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param dependencyId dependency ID
     * @param request dependency 수정 요청
     * @return 수정된 WBS dependency
     */
    @Operation(summary = "WBS dependency 수정")
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @PutMapping("/dependencies/{dependencyId}")
    public ResponseEntity<WbsDependencyResponse> updateDependency(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "dependency ID") @PathVariable Long dependencyId,
        @Valid @RequestBody UpdateWbsDependencyRequest request
    ) {
        final var result = wbsDependencyService.updateDependency(
            jwt.getSubject(),
            teamId,
            projectId,
            dependencyId,
            new WbsDependencyService.WbsDependencyCommand(
                request.predecessorWbsItemId(),
                request.successorWbsItemId(),
                request.dependencyType()
            )
        );
        return ResponseEntity.ok(WbsDependencyResponse.from(result));
    }

    /**
     * WBS dependency를 삭제한다.
     *
     * @param jwt 인증된 JWT
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param dependencyId dependency ID
     * @return 빈 응답
     */
    @Operation(summary = "WBS dependency 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @DeleteMapping("/dependencies/{dependencyId}")
    public ResponseEntity<Void> deleteDependency(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "dependency ID") @PathVariable Long dependencyId
    ) {
        wbsDependencyService.deleteDependency(jwt.getSubject(), teamId, projectId, dependencyId);
        return ResponseEntity.noContent().build();
    }
}
