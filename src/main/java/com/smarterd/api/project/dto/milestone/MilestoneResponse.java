package com.smarterd.api.project.dto.milestone;

import com.smarterd.domain.pm.milestone.entity.MilestoneType;
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

    @Schema(description = "마일스톤 유형", example = "APPROVAL") MilestoneType type,

    @Nullable @Schema(description = "담당자 사용자 ID", example = "7") Long ownerUserId,

    @Nullable @Schema(description = "담당자 이름", example = "김개발") String ownerName,

    @Nullable @Schema(description = "게이트 준비 메모", example = "승인 전 검토자료 배포 필요") String readinessNote,

    @Schema(description = "정렬 순서", example = "0") int sortOrder,

    @Schema(description = "연결된 WBS 항목 수", example = "5") long linkedWbsItemCount,

    @Schema(description = "완료된 연결 WBS 항목 수", example = "3") long linkedWbsCompletedCount,

    @Schema(description = "달성률 (0~100)", example = "70") int achievementRate,

    @Schema(description = "유입 dependency 수", example = "0") long inboundDependencyCount,

    @Schema(description = "유출 dependency 수", example = "0") long outboundDependencyCount,

    @Schema(description = "다음 wave WBS 항목 수", example = "5") long nextWaveWbsCount,

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
            result.type(),
            result.ownerUserId(),
            result.ownerName(),
            result.readinessNote(),
            result.sortOrder(),
            result.linkedWbsItemCount(),
            result.linkedWbsCompletedCount(),
            result.achievementRate(),
            result.inboundDependencyCount(),
            result.outboundDependencyCount(),
            result.nextWaveWbsCount(),
            result.isDelayed(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
