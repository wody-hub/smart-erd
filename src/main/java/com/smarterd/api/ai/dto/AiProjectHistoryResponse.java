package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.history.AiProjectHistoryView;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Project AI activity history response")
public record AiProjectHistoryResponse(
    @Schema(description = "History items") List<AiProjectHistoryItemResponse> items,

    @Schema(description = "Effective item limit", example = "50") int limit,

    @Schema(description = "Whether more items exist", example = "false") boolean hasMore
) {
    /**
     * Normalizes nullable item collections.
     *
     * @param items history items
     * @param limit effective limit
     * @param hasMore pagination hint
     * @return initialized response
     */
    public AiProjectHistoryResponse {
        items = items == null ? List.of() : List.copyOf(items);
    }

    /**
     * Maps sanitized application history into the API response.
     *
     * @param view sanitized history view
     * @return API history response
     */
    public static AiProjectHistoryResponse from(AiProjectHistoryView view) {
        return new AiProjectHistoryResponse(
            view.items().stream().map(AiProjectHistoryItemResponse::from).toList(),
            view.limit(),
            view.hasMore()
        );
    }
}
