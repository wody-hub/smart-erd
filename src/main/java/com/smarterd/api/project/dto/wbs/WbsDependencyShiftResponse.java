package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsDependencyService.WbsDependencyShiftResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * dependency shift preview/apply 응답.
 */
@Schema(description = "dependency shift preview/apply 응답")
public record WbsDependencyShiftResponse(
    @Schema(description = "dependency graph가 canonical validation을 통과했는지 여부", example = "true")
    boolean graphValid,
    @Schema(description = "실제 DB 반영 여부", example = "false") boolean applied,
    @Schema(description = "변경 제안/적용 목록") List<WbsDependencyShiftItemResponse> updates,
    @Schema(description = "검증 이슈 목록") List<WbsDependencyShiftIssueResponse> issues
) {
    public static WbsDependencyShiftResponse from(WbsDependencyShiftResult result) {
        return new WbsDependencyShiftResponse(
            result.graphValid(),
            result.applied(),
            result.updates().stream().map(WbsDependencyShiftItemResponse::from).toList(),
            result.issues().stream().map(WbsDependencyShiftIssueResponse::from).toList()
        );
    }
}
