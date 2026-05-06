package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsService.WbsItemResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.lang.Nullable;

/**
 * WBS 항목 응답 DTO.
 */
@Schema(description = "WBS 항목 응답")
public record WbsItemResponse(
    @Schema(description = "WBS 항목 ID", example = "100") Long id,

    @Nullable @Schema(description = "부모 WBS 항목 ID", example = "null") Long parentId,

    @Schema(description = "WBS 항목명", example = "요구사항 분석") String name,

    @Schema(description = "트리 깊이 (0~8)", example = "1") int depth,

    @Schema(description = "형제 항목 정렬 순서", example = "0") int sortOrder,

    @Nullable @Schema(description = "담당자 사용자 ID", example = "3") Long assigneeUserId,

    @Nullable @Schema(description = "담당자 이름", example = "홍길동") String assigneeName,

    @Nullable @Schema(description = "시작일", example = "2026-04-20") LocalDate startDate,

    @Nullable @Schema(description = "종료일", example = "2026-04-30") LocalDate endDate,

    @Nullable @Schema(description = "실적 시작일", example = "2026-04-22") LocalDate actualStartDate,

    @Nullable @Schema(description = "실적 종료일", example = "2026-05-02") LocalDate actualEndDate,

    @Schema(description = "진척률 (0~100)", example = "60") int progressRate,

    @Nullable @Schema(description = "기준일 기준 계획 진척률 (0~100)", example = "75") Integer plannedProgressRate,

    @Nullable @Schema(description = "실적 진척률과 계획 진척률의 차이", example = "-15") Integer progressVarianceRate,

    @Nullable @Schema(description = "계획 시작일 대비 실적 시작일 편차 일수", example = "2") Integer startVarianceDays,

    @Nullable @Schema(description = "계획 종료일 대비 실적 종료일 편차 일수", example = "3") Integer endVarianceDays,

    @Nullable @Schema(description = "예상 M/M", example = "1.50") BigDecimal estimatedMm,

    @Nullable @Schema(description = "연결된 마일스톤 ID", example = "10") Long milestoneId,

    @Nullable @Schema(description = "연결된 마일스톤 이름", example = "요구사항 확정") String milestoneName,

    @Schema(description = "선행 WBS 항목 ID 목록", example = "[1, 2]") List<Long> predecessorIds,

    @Schema(description = "후행 WBS 항목 ID 목록", example = "[3, 4]") List<Long> successorIds,

    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,

    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static WbsItemResponse from(WbsItemResult result) {
        return new WbsItemResponse(
            result.id(),
            result.parentId(),
            result.name(),
            result.depth(),
            result.sortOrder(),
            result.assigneeUserId(),
            result.assigneeName(),
            result.startDate(),
            result.endDate(),
            result.actualStartDate(),
            result.actualEndDate(),
            result.progressRate(),
            result.plannedProgressRate(),
            result.progressVarianceRate(),
            result.startVarianceDays(),
            result.endVarianceDays(),
            result.estimatedMm(),
            result.milestoneId(),
            result.milestoneName(),
            result.predecessorIds(),
            result.successorIds(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
