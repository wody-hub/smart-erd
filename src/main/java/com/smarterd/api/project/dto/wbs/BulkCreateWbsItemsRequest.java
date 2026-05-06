package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * WBS 대량 생성 요청.
 */
@Schema(description = "WBS 대량 생성 요청")
public record BulkCreateWbsItemsRequest(
    @Valid @NotEmpty @Schema(description = "생성할 항목 목록") List<BulkCreateWbsItemRequest> items
) {}
