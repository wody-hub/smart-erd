package com.smarterd.api.project.dto.staffing;

import com.smarterd.domain.pm.staffing.service.ProjectStaffingService.ProjectStaffingMonthlyAllocationResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import org.springframework.lang.Nullable;

/**
 * 월별 인력 투입 비교 응답 DTO.
 */
@Schema(description = "프로젝트 인력 투입 월별 비교 응답")
public record ProjectStaffingMonthlyAllocationResponse(
    @Schema(description = "대상 월(yyyy-MM)", example = "2026-04") String month,

    @Schema(description = "계획 M/M", example = "0.50") BigDecimal plannedMm,

    @Nullable @Schema(description = "실적 M/M", example = "0.40") BigDecimal actualMm,

    @Nullable @Schema(description = "실적-계획 델타 M/M", example = "-0.10") BigDecimal deltaMm
) {
    public static ProjectStaffingMonthlyAllocationResponse from(ProjectStaffingMonthlyAllocationResult result) {
        return new ProjectStaffingMonthlyAllocationResponse(
            result.month(),
            result.plannedMm(),
            result.actualMm(),
            result.deltaMm()
        );
    }
}
