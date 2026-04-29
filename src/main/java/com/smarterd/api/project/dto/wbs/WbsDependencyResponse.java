package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.entity.WbsDependencyType;
import com.smarterd.domain.pm.wbs.service.WbsDependencyService.WbsDependencyResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * WBS dependency 응답 DTO.
 */
@Schema(description = "WBS dependency 응답")
public record WbsDependencyResponse(
    @Schema(description = "dependency ID", example = "1") Long id,

    @Schema(description = "선행 WBS 항목 ID", example = "100") Long predecessorWbsItemId,

    @Schema(description = "선행 WBS 항목명", example = "요구사항 분석") String predecessorWbsItemName,

    @Schema(description = "후행 WBS 항목 ID", example = "101") Long successorWbsItemId,

    @Schema(description = "후행 WBS 항목명", example = "화면 설계") String successorWbsItemName,

    @Schema(description = "dependency 타입", example = "FS") WbsDependencyType dependencyType,

    @Schema(description = "정렬 순서", example = "0") int sortOrder,

    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,

    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static WbsDependencyResponse from(WbsDependencyResult result) {
        return new WbsDependencyResponse(
            result.id(),
            result.predecessorWbsItemId(),
            result.predecessorWbsItemName(),
            result.successorWbsItemId(),
            result.successorWbsItemName(),
            result.dependencyType(),
            result.sortOrder(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
