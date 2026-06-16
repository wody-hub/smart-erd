package com.smarterd.application.ai.chat;

import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import com.smarterd.domain.pm.milestone.service.MilestoneService;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import com.smarterd.domain.pm.wbs.service.WbsService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.lang.Nullable;

final class AiReadToolDataSupport {

    private static final int MAX_PROVIDER_FIELD_CHARS = 250;

    private AiReadToolDataSupport() {}

    static List<Long> capDistinct(List<Long> values, int max) {
        return values.stream().filter(Objects::nonNull).distinct().limit(max).toList();
    }

    static Map<String, Object> capMetadata(
        int teamProjectInputCount,
        int teamProjectReadCount,
        int detailedProjectReadCount,
        int factInputCount
    ) {
        return Map.of(
            "teamProjectInputCount",
            teamProjectInputCount,
            "teamProjectReadCount",
            teamProjectReadCount,
            "detailedProjectReadCount",
            detailedProjectReadCount,
            "factInputCount",
            factInputCount,
            "factReadCount",
            Math.min(factInputCount, AiReadContextService.MAX_FACTS),
            "providerContextMaxChars",
            AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS
        );
    }

    static LinkedHashMap<String, Object> fallbackToolData(Long projectId, int maxRows) {
        final var data = new LinkedHashMap<String, Object>();
        data.put("projectId", projectId);
        data.put("count", maxRows);
        data.put("maxRows", maxRows);
        data.put("items", List.of());
        return data;
    }

    static LinkedHashMap<String, Object> rowsToolData(
        Long projectId,
        int totalCount,
        int maxRows,
        List<Map<String, Object>> rows
    ) {
        final var data = new LinkedHashMap<String, Object>();
        data.put("projectId", projectId);
        data.put("count", rows.size());
        data.put("returnedCount", rows.size());
        data.put("totalCount", totalCount);
        data.put("maxRows", maxRows);
        data.put("truncated", totalCount > rows.size());
        data.put("items", rows);
        return data;
    }

    static Map<String, Object> wbsRow(WbsService.WbsItemResult item) {
        final var row = baseRow(item.id(), item.name());
        put(row, "parentId", item.parentId());
        row.put("depth", item.depth());
        put(row, "assigneeName", item.assigneeName());
        put(row, "startDate", item.startDate());
        put(row, "endDate", item.endDate());
        put(row, "actualStartDate", item.actualStartDate());
        put(row, "actualEndDate", item.actualEndDate());
        row.put("progressRate", item.progressRate());
        put(row, "plannedProgressRate", item.plannedProgressRate());
        put(row, "progressVarianceRate", item.progressVarianceRate());
        put(row, "startVarianceDays", item.startVarianceDays());
        put(row, "endVarianceDays", item.endVarianceDays());
        put(row, "estimatedMm", item.estimatedMm());
        put(row, "milestoneId", item.milestoneId());
        put(row, "milestoneName", item.milestoneName());
        put(row, "predecessorIds", item.predecessorIds());
        put(row, "successorIds", item.successorIds());
        put(row, "updatedAt", item.updatedAt());
        return row;
    }

    static Map<String, Object> milestoneRow(MilestoneService.MilestoneResult milestone) {
        final var row = baseRow(milestone.id(), milestone.name());
        put(row, "targetDate", milestone.targetDate());
        put(row, "description", milestone.description());
        row.put("type", milestone.type().name());
        put(row, "ownerName", milestone.ownerName());
        put(row, "readinessNote", milestone.readinessNote());
        row.put("linkedWbsItemCount", milestone.linkedWbsItemCount());
        row.put("linkedWbsCompletedCount", milestone.linkedWbsCompletedCount());
        row.put("achievementRate", milestone.achievementRate());
        row.put("inboundDependencyCount", milestone.inboundDependencyCount());
        row.put("outboundDependencyCount", milestone.outboundDependencyCount());
        row.put("nextWaveWbsCount", milestone.nextWaveWbsCount());
        row.put("isDelayed", milestone.isDelayed());
        put(row, "updatedAt", milestone.updatedAt());
        return row;
    }

    static Map<String, Object> issueRow(ProjectIssueService.ProjectIssueResult issue) {
        final var row = baseRow(issue.id(), issue.title());
        put(row, "title", issue.title());
        put(row, "description", issue.description());
        row.put("priority", issue.priority().name());
        row.put("status", issue.status().name());
        put(row, "assigneeName", issue.assigneeName());
        put(row, "createdAt", issue.createdAt());
        put(row, "updatedAt", issue.updatedAt());
        return row;
    }

    static Map<String, Object> todoRow(ProjectTodoService.ProjectTodoResult todo) {
        final var row = baseRow(todo.id(), todo.title());
        put(row, "title", todo.title());
        put(row, "description", todo.description());
        row.put("status", todo.status().name());
        row.put("priority", todo.priority().name());
        put(row, "targetDate", todo.targetDate());
        row.put("progressRate", todo.progressRate());
        put(row, "linkedWbsItemId", todo.linkedWbsItemId());
        put(row, "linkedWbsItemName", todo.linkedWbsItemName());
        put(row, "updatedAt", todo.updatedAt());
        return row;
    }

    static LinkedHashMap<String, Object> baseHistoryRow(
        WbsService.WbsItemResult item,
        String type,
        Long id,
        @Nullable Object occurredAt
    ) {
        final var row = new LinkedHashMap<String, Object>();
        row.put("id", id);
        row.put("type", type);
        row.put("targetType", "WBS");
        row.put("targetId", item.id());
        row.put("targetName", item.name());
        put(row, "occurredAt", occurredAt);
        return row;
    }

    static void put(Map<String, Object> row, String key, @Nullable Object value) {
        if (value != null) {
            row.put(key, value instanceof String text ? truncateText(text) : value);
        }
    }

    static String truncateText(String value) {
        if (value.length() <= MAX_PROVIDER_FIELD_CHARS) {
            return value;
        }
        return value.substring(0, MAX_PROVIDER_FIELD_CHARS) + "...[truncated]";
    }

    /**
     * Creates a common row shape with id and capped display name.
     *
     * @param id row id
     * @param name row display name
     * @return base row map
     */
    private static LinkedHashMap<String, Object> baseRow(Long id, String name) {
        final var row = new LinkedHashMap<String, Object>();
        row.put("id", id);
        row.put("name", truncateText(name));
        return row;
    }
}
