package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * dependency shift anchor 요청.
 */
@Schema(description = "dependency shift anchor 요청")
public record WbsDependencyShiftItemRequest(
    @NotNull(message = "{validation.not-null.wbs-id}")
    @Schema(description = "이동 기준 WBS ID", example = "101")
    Long wbsItemId,
    @NotNull(message = "{validation.not-null.wbs-dependency-shift-start-date}")
    @Schema(description = "새 시작일", example = "2026-05-12")
    LocalDate startDate,
    @NotNull(message = "{validation.not-null.wbs-dependency-shift-end-date}")
    @Schema(description = "새 종료일", example = "2026-05-16")
    LocalDate endDate
) {}
