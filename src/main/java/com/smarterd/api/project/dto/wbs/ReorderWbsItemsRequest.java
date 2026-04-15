package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * WBS 재정렬 요청 DTO.
 */
@Schema(description = "WBS 재정렬 요청")
public record ReorderWbsItemsRequest(
    @Schema(description = "재정렬할 항목 목록")
    @NotEmpty(message = "{validation.not-empty.wbs-reorder-items}")
    List<@Valid WbsReorderItemRequest> items
) {}
