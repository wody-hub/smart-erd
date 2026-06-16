package com.smarterd.application.ai.history;

import java.util.List;

public record AiProjectHistoryView(int limit, boolean hasMore, List<AiProjectHistoryItemView> items) {
    /**
     * Normalizes nullable item collections.
     *
     * @param limit effective limit
     * @param hasMore pagination hint
     * @param items history items
     * @return initialized history view
     */
    public AiProjectHistoryView {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
