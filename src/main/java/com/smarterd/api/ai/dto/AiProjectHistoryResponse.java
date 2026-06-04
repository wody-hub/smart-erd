package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.history.AiProjectHistoryService;
import java.time.Instant;
import java.util.List;

public record AiProjectHistoryResponse(
    List<ItemResponse> items,
    int limit,
    boolean hasMore
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
    public static AiProjectHistoryResponse from(AiProjectHistoryService.AiProjectHistoryView view) {
        return new AiProjectHistoryResponse(
            view.items().stream().map(ItemResponse::from).toList(),
            view.limit(),
            view.hasMore()
        );
    }

    public record ItemResponse(
        String kind,
        String executionId,
        String proposalId,
        String provider,
        String promptVersion,
        String actionType,
        String riskLevel,
        String status,
        String targetType,
        String targetId,
        String targetLabel,
        String summary,
        String requestedBy,
        String decisionBy,
        Instant createdAt,
        Instant decidedAt,
        String redactedErrorTitle,
        String redactedErrorDetail,
        Instant activityAt
    ) {
        /**
         * Maps one sanitized history item into the API response.
         *
         * @param item sanitized history item
         * @return API item response
         */
        private static ItemResponse from(AiProjectHistoryService.AiProjectHistoryItemView item) {
            return new ItemResponse(
                item.kind(),
                item.executionId(),
                item.proposalId(),
                item.provider(),
                item.promptVersion(),
                item.actionType(),
                item.riskLevel(),
                item.status(),
                item.targetType(),
                item.targetId(),
                item.targetLabel(),
                item.summary(),
                item.requestedBy(),
                item.decisionBy(),
                item.createdAt(),
                item.decidedAt(),
                item.redactedErrorTitle(),
                item.redactedErrorDetail(),
                item.activityAt()
            );
        }
    }
}
