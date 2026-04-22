package com.smarterd.api.project.dto.staffing;

import com.smarterd.domain.pm.staffing.entity.StaffingGrade;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 인력 투입 생성 요청 DTO.
 */
@Schema(description = "프로젝트 인력 투입 생성 요청")
public record CreateProjectStaffingRequest(
    @Schema(description = "멤버 사용자 ID", example = "7")
    @NotNull(message = "{validation.not-null.staffing-user-id}")
    Long userId,

    @Schema(description = "인력 등급", example = "MIDDLE")
    @NotNull(message = "{validation.not-null.staffing-grade}")
    StaffingGrade grade,

    @Schema(description = "월 단가(KRW)", example = "12000000")
    @NotNull(message = "{validation.not-null.staffing-monthly-rate}")
    @Min(value = 0, message = "{validation.min.staffing-monthly-rate}")
    @Max(value = 999999999, message = "{validation.max.staffing-monthly-rate}")
    Long monthlyRate,

    @Schema(description = "계획 시작일", example = "2026-04-01")
    @NotNull(message = "{validation.not-null.staffing-planned-start-date}")
    LocalDate plannedStartDate,

    @Schema(description = "계획 종료일", example = "2026-05-31")
    @NotNull(message = "{validation.not-null.staffing-planned-end-date}")
    LocalDate plannedEndDate,

    @Schema(description = "계획 참여율(0~100)", example = "100")
    @NotNull(message = "{validation.not-null.staffing-planned-participation-rate}")
    @Min(value = 0, message = "{validation.min.staffing-planned-participation-rate}")
    @Max(value = 100, message = "{validation.max.staffing-planned-participation-rate}")
    Integer plannedParticipationRate,

    @Schema(description = "실적 시작일", example = "2026-04-02") @Nullable LocalDate actualStartDate,

    @Schema(description = "실적 종료일", example = "2026-05-30") @Nullable LocalDate actualEndDate,

    @Schema(description = "실적 참여율(0~100)", example = "90")
    @Nullable
    @Min(value = 0, message = "{validation.min.staffing-actual-participation-rate}")
    @Max(value = 100, message = "{validation.max.staffing-actual-participation-rate}")
    Integer actualParticipationRate
) {
    @AssertTrue(message = "{validation.staffing-planned-period.invalid}")
    public boolean isPlannedPeriodValid() {
        return plannedStartDate == null || plannedEndDate == null || !plannedStartDate.isAfter(plannedEndDate);
    }

    @AssertTrue(message = "{validation.staffing-actual-period.pair-required}")
    public boolean isActualPeriodAtomic() {
        final var allNull = actualStartDate == null && actualEndDate == null && actualParticipationRate == null;
        final var allPresent = actualStartDate != null && actualEndDate != null && actualParticipationRate != null;
        return allNull || allPresent;
    }

    @AssertTrue(message = "{validation.staffing-actual-period.invalid}")
    public boolean isActualPeriodValid() {
        return actualStartDate == null || actualEndDate == null || !actualStartDate.isAfter(actualEndDate);
    }
}
