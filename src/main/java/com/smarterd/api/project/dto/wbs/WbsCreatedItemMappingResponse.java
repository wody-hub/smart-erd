package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsPlanningService.BulkCreateItemResult;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 대량 생성 결과의 clientKey 매핑.
 */
@Schema(description = "대량 생성 결과의 clientKey 매핑")
public record WbsCreatedItemMappingResponse(
    @Schema(description = "요청 clientKey", example = "task-api-design") String clientKey,
    @Schema(description = "생성된 WBS 항목") WbsItemResponse item
) {
    public static WbsCreatedItemMappingResponse from(BulkCreateItemResult result) {
        return new WbsCreatedItemMappingResponse(result.clientKey(), WbsItemResponse.from(result.item()));
    }
}
