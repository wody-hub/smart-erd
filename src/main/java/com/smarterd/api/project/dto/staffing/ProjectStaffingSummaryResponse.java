package com.smarterd.api.project.dto.staffing;

import com.smarterd.domain.pm.staffing.service.ProjectStaffingService.ProjectStaffingSummaryResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/**
 * 프로젝트 인력 투입 합계 응답 DTO.
 */
@Schema(description = "프로젝트 인력 투입 합계 응답")
public record ProjectStaffingSummaryResponse(
    @Schema(description = "총 계획 M/M", example = "2.50") BigDecimal plannedMm,

    @Schema(description = "총 실적 M/M", example = "2.10") BigDecimal actualMm,

    @Schema(description = "총 델타 M/M", example = "-0.40") BigDecimal deltaMm,

    @Schema(description = "총 계획 인건비(KRW)", example = "31500000") long plannedCost,

    @Schema(description = "총 실적 인건비(KRW)", example = "25200000") long actualCost
) {
    public static ProjectStaffingSummaryResponse from(ProjectStaffingSummaryResult result) {
        return new ProjectStaffingSummaryResponse(
            result.plannedMm(),
            result.actualMm(),
            result.deltaMm(),
            result.plannedCost(),
            result.actualCost()
        );
    }
}
