package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsPlanningService.WbsMutationResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * WBS subtree 생성/복제 결과.
 */
@Schema(description = "WBS subtree 생성/복제 결과")
public record WbsSubtreeMutationResponse(
    @Schema(description = "생성된 subtree 루트 WBS ID", example = "301") Long rootItemId,
    @Schema(description = "생성된 WBS 항목 목록") List<WbsItemResponse> items,
    @Schema(description = "생성된 dependency 목록") List<WbsDependencyResponse> dependencies
) {
    public static WbsSubtreeMutationResponse from(WbsMutationResult result) {
        return new WbsSubtreeMutationResponse(
            result.rootItemId(),
            result.items().stream().map(WbsItemResponse::from).toList(),
            result.dependencies().stream().map(WbsDependencyResponse::from).toList()
        );
    }
}
