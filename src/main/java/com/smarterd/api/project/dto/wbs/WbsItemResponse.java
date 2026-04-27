package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsService.WbsItemResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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

    @Schema(description = "진척률 (0~100)", example = "60") int progressRate,

    @Nullable @Schema(description = "예상 M/M", example = "1.50") BigDecimal estimatedMm,

    @Nullable @Schema(description = "연결된 마일스톤 ID", example = "10") Long milestoneId,

    @Nullable @Schema(description = "연결된 마일스톤 이름", example = "요구사항 확정") String milestoneName,

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
            result.progressRate(),
            result.estimatedMm(),
            result.milestoneId(),
            result.milestoneName(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
