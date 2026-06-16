package com.smarterd.application.ai.chat;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkActivityResult;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkCommentResult;
import com.smarterd.domain.pm.wbs.service.WbsService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.lang.Nullable;

final class AiHistoryReadCollector {

    @Nullable
    private final WbsService wbsService;

    @Nullable
    private final WorkItemHistoryService workItemHistoryService;

    AiHistoryReadCollector(@Nullable WbsService wbsService, @Nullable WorkItemHistoryService workItemHistoryService) {
        this.wbsService = wbsService;
        this.workItemHistoryService = workItemHistoryService;
    }

    void collectHistory(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<AiReadContextService.ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("Recent history/comment summary loaded");
        if (workItemHistoryService == null || wbsService == null) {
            toolData.put(
                "history:" + projectId,
                AiReadToolDataSupport.fallbackToolData(projectId, AiReadContextService.MAX_HISTORY_ROWS)
            );
            toolResults.add(
                new AiReadContextService.ToolReadResult(projectLabel, "history", AiReadContextService.MAX_HISTORY_ROWS)
            );
            return;
        }

        final var historyData = collectRecentHistoryRows(loginId, teamId, projectId);
        facts.add(
            projectLabel +
                " recent history rows loaded: returned=" +
                historyData.rows().size() +
                " total=" +
                historyData.totalCount()
        );
        final var historyToolData = AiReadToolDataSupport.rowsToolData(
            projectId,
            historyData.totalCount(),
            AiReadContextService.MAX_HISTORY_ROWS,
            historyData.rows()
        );
        historyToolData.put("wbsScannedCount", historyData.scannedContainerCount());
        historyToolData.put("wbsTotalCount", historyData.totalContainerCount());
        historyToolData.put("wbsScanTruncated", historyData.scanTruncated());
        if (historyData.scanTruncated()) {
            historyToolData.put("truncated", true);
        }
        toolData.put("history:" + projectId, historyToolData);
        toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "history", historyData.rows().size()));
    }

    /**
     * Collects recent comment and activity rows from capped WBS items.
     *
     * @param loginId requester login id
     * @param teamId team id
     * @param projectId project id
     * @return capped history row data
     */
    private RowReadData collectRecentHistoryRows(String loginId, Long teamId, Long projectId) {
        final var rows = new ArrayList<HistoryRow>();
        final var allWbsItems = wbsService.getWbsItems(loginId, teamId, projectId);
        final var wbsItems = allWbsItems.stream().limit(AiReadContextService.MAX_WBS_DETAIL_ROWS).toList();
        for (final var item : wbsItems) {
            workItemHistoryService
                .getWbsComments(loginId, teamId, projectId, item.id())
                .forEach((comment) -> rows.add(historyCommentRow(item, comment)));
            workItemHistoryService
                .getWbsActivities(loginId, teamId, projectId, item.id())
                .forEach((activity) -> rows.add(historyActivityRow(item, activity)));
        }
        final var cappedRows = rows
            .stream()
            .sorted(Comparator.comparing(HistoryRow::occurredAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(AiReadContextService.MAX_HISTORY_ROWS)
            .map(HistoryRow::data)
            .toList();
        return new RowReadData(cappedRows, rows.size(), wbsItems.size(), allWbsItems.size());
    }

    /**
     * Maps one WBS comment into provider-safe history row data.
     *
     * @param item WBS item
     * @param comment comment result
     * @return history row
     */
    private static HistoryRow historyCommentRow(WbsService.WbsItemResult item, WorkCommentResult comment) {
        final var row = AiReadToolDataSupport.baseHistoryRow(item, "comment", comment.id(), comment.createdAt());
        AiReadToolDataSupport.put(row, "content", comment.content());
        AiReadToolDataSupport.put(row, "actorName", comment.actorName());
        return new HistoryRow(row, comment.createdAt());
    }

    /**
     * Maps one WBS activity into provider-safe history row data.
     *
     * @param item WBS item
     * @param activity activity result
     * @return history row
     */
    private static HistoryRow historyActivityRow(WbsService.WbsItemResult item, WorkActivityResult activity) {
        final var row = AiReadToolDataSupport.baseHistoryRow(item, "activity", activity.id(), activity.occurredAt());
        row.put("eventType", activity.eventType().name());
        AiReadToolDataSupport.put(
            row,
            "subjectType",
            activity.subjectType() == null ? null : activity.subjectType().name()
        );
        AiReadToolDataSupport.put(row, "subjectId", activity.subjectId());
        AiReadToolDataSupport.put(row, "subjectLabel", activity.subjectLabel());
        AiReadToolDataSupport.put(row, "previousValue", activity.previousValue());
        AiReadToolDataSupport.put(row, "currentValue", activity.currentValue());
        AiReadToolDataSupport.put(row, "detail", activity.detail());
        AiReadToolDataSupport.put(row, "actorName", activity.actorName());
        return new HistoryRow(row, activity.occurredAt());
    }

    private record RowReadData(
        List<Map<String, Object>> rows,
        int totalCount,
        int scannedContainerCount,
        int totalContainerCount
    ) {
        /**
         * Checks whether container scanning was truncated.
         *
         * @return true when not all containers were scanned
         */
        private boolean scanTruncated() {
            return totalContainerCount > scannedContainerCount;
        }
    }

    private record HistoryRow(Map<String, Object> data, @Nullable java.time.Instant occurredAt) {}
}
