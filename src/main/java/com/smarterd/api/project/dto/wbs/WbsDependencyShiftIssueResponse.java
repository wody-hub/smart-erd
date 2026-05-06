package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsDependencyService.WbsDependencyShiftIssueResult;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.lang.Nullable;

/**
 * dependency shift 검증 이슈 응답.
 */
@Schema(description = "dependency shift 검증 이슈 응답")
public record WbsDependencyShiftIssueResponse(
    @Nullable @Schema(description = "관련 WBS ID", example = "102") Long wbsItemId,
    @Schema(description = "검증 코드", example = "missing-date") String code,
    @Schema(description = "검증 메시지", example = "후행 WBS 일정이 비어 있어 자동 시프트를 계산할 수 없습니다.") String message
) {
    public static WbsDependencyShiftIssueResponse from(WbsDependencyShiftIssueResult result) {
        return new WbsDependencyShiftIssueResponse(result.wbsItemId(), result.code(), result.message());
    }
}
