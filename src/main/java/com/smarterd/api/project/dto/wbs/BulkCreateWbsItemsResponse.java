package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsPlanningService.BulkCreateResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * WBS 대량 생성 응답.
 */
@Schema(description = "WBS 대량 생성 응답")
public record BulkCreateWbsItemsResponse(
    @Schema(description = "생성 결과 목록") List<WbsCreatedItemMappingResponse> items
) {
    public static BulkCreateWbsItemsResponse from(BulkCreateResult result) {
        return new BulkCreateWbsItemsResponse(result.items().stream().map(WbsCreatedItemMappingResponse::from).toList());
    }
}
