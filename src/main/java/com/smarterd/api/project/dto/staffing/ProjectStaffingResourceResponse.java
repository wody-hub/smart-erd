package com.smarterd.api.project.dto.staffing;

import com.smarterd.domain.pm.staffing.entity.StaffingGrade;
import com.smarterd.domain.pm.staffing.service.ProjectStaffingService.ProjectStaffingResourceResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 인력 투입 리소스 응답 DTO.
 */
@Schema(description = "프로젝트 인력 투입 리소스 응답")
public record ProjectStaffingResourceResponse(
    @Schema(description = "인력 투입 ID", example = "101") Long id,

    @Schema(description = "멤버 사용자 ID", example = "7") Long userId,

    @Schema(description = "멤버 이름", example = "홍길동") String memberName,

    @Nullable @Schema(description = "멤버 로그인 ID", example = "hong") String memberLoginId,

    @Schema(description = "인력 등급", example = "SENIOR") StaffingGrade grade,

    @Schema(description = "월 단가(KRW)", example = "12000000") long monthlyRate,

    @Schema(description = "계획 시작일", example = "2026-04-01") LocalDate plannedStartDate,

    @Schema(description = "계획 종료일", example = "2026-05-31") LocalDate plannedEndDate,

    @Schema(description = "계획 참여율(0~100)", example = "100") int plannedParticipationRate,

    @Schema(description = "계획 M/M", example = "1.98") BigDecimal plannedMm,

    @Schema(description = "계획 인건비(KRW)", example = "23760000") long plannedCost,

    @Nullable @Schema(description = "실적 시작일", example = "2026-04-03") LocalDate actualStartDate,

    @Nullable @Schema(description = "실적 종료일", example = "2026-05-28") LocalDate actualEndDate,

    @Nullable @Schema(description = "실적 참여율(0~100)", example = "90") Integer actualParticipationRate,

    @Nullable @Schema(description = "실적 M/M", example = "1.76") BigDecimal actualMm,

    @Nullable @Schema(description = "실적 인건비(KRW)", example = "21120000") Long actualCost,

    @Nullable @Schema(description = "실적-계획 델타 M/M", example = "-0.22") BigDecimal deltaMm,

    @Schema(description = "월별 계획/실적 비교 목록") List<ProjectStaffingMonthlyAllocationResponse> monthlyAllocations,

    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,

    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static ProjectStaffingResourceResponse from(ProjectStaffingResourceResult result) {
        return new ProjectStaffingResourceResponse(
            result.id(),
            result.userId(),
            result.memberName(),
            result.memberLoginId(),
            result.grade(),
            result.monthlyRate(),
            result.plannedStartDate(),
            result.plannedEndDate(),
            result.plannedParticipationRate(),
            result.plannedMm(),
            result.plannedCost(),
            result.actualStartDate(),
            result.actualEndDate(),
            result.actualParticipationRate(),
            result.actualMm(),
            result.actualCost(),
            result.deltaMm(),
            result.monthlyAllocations().stream().map(ProjectStaffingMonthlyAllocationResponse::from).toList(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
