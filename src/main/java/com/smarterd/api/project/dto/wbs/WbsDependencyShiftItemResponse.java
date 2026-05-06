package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsDependencyService.WbsDependencyShiftItemResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;

/**
 * dependency shift 제안/적용 항목 응답.
 */
@Schema(description = "dependency shift 제안/적용 항목 응답")
public record WbsDependencyShiftItemResponse(
    @Schema(description = "WBS ID", example = "101") Long wbsItemId,
    @Schema(description = "변경 전 시작일", example = "2026-05-10") LocalDate originalStartDate,
    @Schema(description = "변경 전 종료일", example = "2026-05-14") LocalDate originalEndDate,
    @Schema(description = "변경 후 시작일", example = "2026-05-12") LocalDate startDate,
    @Schema(description = "변경 후 종료일", example = "2026-05-16") LocalDate endDate,
    @Schema(description = "anchor 변경 여부", example = "false") boolean anchor
) {
    public static WbsDependencyShiftItemResponse from(WbsDependencyShiftItemResult result) {
        return new WbsDependencyShiftItemResponse(
            result.wbsItemId(),
            result.originalStartDate(),
            result.originalEndDate(),
            result.startDate(),
            result.endDate(),
            result.anchor()
        );
    }
}
