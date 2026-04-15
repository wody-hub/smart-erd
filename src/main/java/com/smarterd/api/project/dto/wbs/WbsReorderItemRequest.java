package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.lang.Nullable;

/**
 * WBS 재정렬 항목 DTO.
 */
@Schema(description = "WBS 재정렬 항목")
public record WbsReorderItemRequest(
    @Schema(description = "재정렬 대상 WBS 항목 ID", example = "100")
    @NotNull(message = "{validation.not-null.wbs-id}")
    Long id,

    @Schema(description = "이동 후 부모 WBS ID (루트면 null)", example = "null") @Nullable Long parentId,

    @Schema(description = "이동 후 정렬 순서", example = "2")
    @NotNull(message = "{validation.not-null.wbs-sort-order}")
    @Min(value = 0, message = "{validation.min.wbs-sort-order}")
    Integer sortOrder
) {}
