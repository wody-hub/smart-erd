package com.smarterd.api.project.dto.milestone;

import com.smarterd.domain.pm.milestone.service.MilestoneService.MilestoneResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * 마일스톤 응답 DTO.
 */
@Schema(description = "마일스톤 응답")
public record MilestoneResponse(
    @Schema(description = "마일스톤 ID", example = "10") Long id,

    @Schema(description = "프로젝트 ID", example = "1") Long projectId,

    @Schema(description = "마일스톤 이름", example = "요구사항 확정") String name,

    @Schema(description = "목표일", example = "2026-05-31") LocalDate targetDate,

    @Nullable @Schema(description = "설명", example = "분석 산출물 완료") String description,

    @Schema(description = "정렬 순서", example = "0") int sortOrder,

    @Schema(description = "연결된 WBS 항목 수", example = "5") long linkedWbsItemCount,

    @Schema(description = "달성률 (0~100)", example = "70") int achievementRate,

    @Schema(description = "지연 여부", example = "false") boolean isDelayed,

    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,

    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static MilestoneResponse from(MilestoneResult result) {
        return new MilestoneResponse(
            result.id(),
            result.projectId(),
            result.name(),
            result.targetDate(),
            result.description(),
            result.sortOrder(),
            result.linkedWbsItemCount(),
            result.achievementRate(),
            result.isDelayed(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
