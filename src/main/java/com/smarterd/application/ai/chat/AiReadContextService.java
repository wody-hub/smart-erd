package com.smarterd.application.ai.chat;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkActivityResult;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkCommentResult;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import com.smarterd.domain.pm.milestone.service.MilestoneService;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import com.smarterd.domain.pm.wbs.service.WbsService;
import com.smarterd.domain.project.service.ProjectService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

/**
 * Collects authorized read-only context summaries for AI chat.
 */
@Service
public class AiReadContextService {

    public static final int MAX_TEAM_PROJECTS = 20;
    public static final int MAX_DETAILED_PROJECTS = 5;
    public static final int MAX_WBS_SUMMARY_ROWS = 50;
    public static final int MAX_WBS_DETAIL_ROWS = 25;
    public static final int MAX_MILESTONE_ROWS = 30;
    public static final int MAX_ISSUE_SUMMARY_ROWS = 50;
    public static final int MAX_ISSUE_DETAIL_ROWS = 25;
    public static final int MAX_OWN_TODO_ROWS = 30;
    public static final int MAX_MEMBER_TODO_OWNERS = 20;
    public static final int MAX_HISTORY_ROWS = 25;
    public static final int MAX_FACTS = 200;
    public static final int MAX_PROVIDER_CONTEXT_CHARS = 12_000;
    private static final int MAX_PROVIDER_FIELD_CHARS = 250;

    @Nullable
    private final ProjectService projectService;

    @Nullable
    private final WbsService wbsService;

    @Nullable
    private final MilestoneService milestoneService;

    @Nullable
    private final ProjectIssueService projectIssueService;

    @Nullable
    private final ProjectTodoService projectTodoService;

    @Nullable
    private final WorkItemHistoryService workItemHistoryService;

    private final AiSourceChipFactory sourceChipFactory;

    public AiReadContextService() {
        this(null, null, null, null, null, null, new AiSourceChipFactory());
    }

    @Autowired
    public AiReadContextService(
        @Nullable ProjectService projectService,
        @Nullable WbsService wbsService,
        @Nullable MilestoneService milestoneService,
        @Nullable ProjectIssueService projectIssueService,
        @Nullable ProjectTodoService projectTodoService,
        @Nullable WorkItemHistoryService workItemHistoryService,
        AiSourceChipFactory sourceChipFactory
    ) {
        this.projectService = projectService;
        this.wbsService = wbsService;
        this.milestoneService = milestoneService;
        this.projectIssueService = projectIssueService;
        this.projectTodoService = projectTodoService;
        this.workItemHistoryService = workItemHistoryService;
        this.sourceChipFactory = sourceChipFactory;
    }

    public ReadContext read(String loginId, ReadCommand command) {
        final var selectedTools = command.tools().isEmpty() ? selectTools(command.userQuestion()) : command.tools();
        final var projectIds = capDistinct(command.projectIds(), MAX_TEAM_PROJECTS);
        final var detailedProjectIds = capDistinct(projectIds, MAX_DETAILED_PROJECTS);
        final var facts = new ArrayList<String>();
        final var toolResults = new ArrayList<ToolReadResult>();
        final var toolData = new LinkedHashMap<String, Object>();

        for (final var projectId : detailedProjectIds) {
            final var projectLabel = projectLabel(loginId, command.teamId(), projectId);
            if (selectedTools.contains(ReadTool.OVERVIEW)) {
                collectOverview(loginId, command.teamId(), projectId, projectLabel, facts, toolResults, toolData);
            }
            if (selectedTools.contains(ReadTool.WBS)) {
                collectWbs(
                    loginId,
                    command.teamId(),
                    projectId,
                    projectLabel,
                    command.userQuestion(),
                    facts,
                    toolResults,
                    toolData
                );
            }
            if (selectedTools.contains(ReadTool.MILESTONES)) {
                collectMilestones(loginId, command.teamId(), projectId, projectLabel, facts, toolResults, toolData);
            }
            if (selectedTools.contains(ReadTool.ISSUES)) {
                collectIssues(
                    loginId,
                    command.teamId(),
                    projectId,
                    projectLabel,
                    command.userQuestion(),
                    facts,
                    toolResults,
                    toolData
                );
            }
            if (selectedTools.contains(ReadTool.TODO)) {
                collectTodos(loginId, command, projectId, projectLabel, facts, toolResults, toolData);
            }
            if (selectedTools.contains(ReadTool.HISTORY)) {
                collectHistory(loginId, command.teamId(), projectId, projectLabel, facts, toolResults, toolData);
            }
        }

        final var cappedFacts = List.copyOf(facts.stream().limit(MAX_FACTS).map(AiReadContextService::truncateText).toList());
        final var capMetadata = capMetadata(command.projectIds().size(), projectIds.size(), detailedProjectIds.size(), facts.size());
        final var sourceChips = sourceChipFactory.fromToolResults(toolResults);
        final var sanitizedContext = sanitizedContext(cappedFacts, sourceChips, selectedTools, capMetadata, toolData);
        final var providerContext = truncateProviderContext(
            serializeProviderContext(cappedFacts, sourceChips, capMetadata, toolData)
        );

        return new ReadContext(
            cappedFacts,
            sourceChips,
            List.of(),
            sanitizedContext,
            providerContext,
            selectedTools,
            capMetadata
        );
    }

    public Set<ReadTool> selectTools(@Nullable String question) {
        final var text = question == null ? "" : question.toLowerCase(Locale.ROOT);
        final var tools = new LinkedHashSet<ReadTool>();
        if (containsAny(text, "overview", "summary", "project", "business", "개요", "사업", "프로젝트")) {
            tools.add(ReadTool.OVERVIEW);
        }
        if (containsAny(text, "wbs", "work", "작업", "지연", "미완료", "진척", "담당")) {
            tools.add(ReadTool.WBS);
        }
        if (containsAny(text, "milestone", "schedule", "마일스톤", "일정")) {
            tools.add(ReadTool.MILESTONES);
        }
        if (containsAny(text, "issue", "risk", "이슈", "리스크")) {
            tools.add(ReadTool.ISSUES);
        }
        if (containsAny(text, "todo", "to-do", "할 일", "해야 할", "담당", "미완료")) {
            tools.add(ReadTool.TODO);
        }
        if (containsAny(text, "history", "comment", "activity", "히스토리", "코멘트", "댓글", "이력")) {
            tools.add(ReadTool.HISTORY);
        }
        if (tools.isEmpty()) {
            tools.add(ReadTool.OVERVIEW);
        }
        return Set.copyOf(tools);
    }

    private void collectOverview(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("Project overview summary loaded");
        if (projectService == null) {
            toolData.put("overview:" + projectId, Map.of("projectId", projectId, "projectName", projectLabel));
            toolResults.add(new ToolReadResult(projectLabel, "overview", 1));
            return;
        }
        final var overview = projectService.getBusinessOverview(loginId, teamId, projectId);
        toolData.put(
            "overview:" + projectId,
            Map.of(
                "projectId",
                overview.projectId(),
                "projectName",
                overview.projectName(),
                "memberCount",
                overview.memberCount(),
                "documentCount",
                overview.documentCount(),
                "progressRate",
                overview.progressRate() == null ? "" : overview.progressRate()
            )
        );
        toolResults.add(new ToolReadResult(overview.projectName(), "overview", 1));
    }

    private void collectWbs(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        @Nullable String question,
        List<String> facts,
        List<ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("WBS risk summary loaded");
        final var maxRows = wantsDetail(question) ? MAX_WBS_DETAIL_ROWS : MAX_WBS_SUMMARY_ROWS;
        if (wbsService == null) {
            toolData.put("wbs:" + projectId, fallbackToolData(projectId, maxRows));
            toolResults.add(new ToolReadResult(projectLabel, "WBS", maxRows));
            return;
        }

        final var wbsItems = wbsService.getWbsItems(loginId, teamId, projectId);
        final var rows = wbsItems.stream().limit(maxRows).map(AiReadContextService::wbsRow).toList();
        facts.add(projectLabel + " WBS rows loaded: returned=" + rows.size() + " total=" + wbsItems.size());
        toolData.put("wbs:" + projectId, rowsToolData(projectId, wbsItems.size(), maxRows, rows));
        toolResults.add(new ToolReadResult(projectLabel, "WBS", rows.size()));
    }

    private void collectMilestones(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("Milestone delay summary loaded");
        if (milestoneService == null) {
            toolData.put("milestones:" + projectId, fallbackToolData(projectId, MAX_MILESTONE_ROWS));
            toolResults.add(new ToolReadResult(projectLabel, "milestones", MAX_MILESTONE_ROWS));
            return;
        }

        final var milestones = milestoneService.getMilestones(loginId, teamId, projectId);
        final var rows = milestones.stream().limit(MAX_MILESTONE_ROWS).map(AiReadContextService::milestoneRow).toList();
        facts.add(projectLabel + " milestone rows loaded: returned=" + rows.size() + " total=" + milestones.size());
        toolData.put("milestones:" + projectId, rowsToolData(projectId, milestones.size(), MAX_MILESTONE_ROWS, rows));
        toolResults.add(new ToolReadResult(projectLabel, "milestones", rows.size()));
    }

    private void collectIssues(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        @Nullable String question,
        List<String> facts,
        List<ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("Issue status summary loaded");
        final var maxRows = wantsDetail(question) ? MAX_ISSUE_DETAIL_ROWS : MAX_ISSUE_SUMMARY_ROWS;
        if (projectIssueService == null) {
            toolData.put("issues:" + projectId, fallbackToolData(projectId, maxRows));
            toolResults.add(new ToolReadResult(projectLabel, "issues", maxRows));
            return;
        }

        final var issues = projectIssueService.getProjectIssues(loginId, teamId, projectId, null);
        final var rows = issues.stream().limit(maxRows).map(AiReadContextService::issueRow).toList();
        facts.add(projectLabel + " issue rows loaded: returned=" + rows.size() + " total=" + issues.size());
        toolData.put("issues:" + projectId, rowsToolData(projectId, issues.size(), maxRows, rows));
        toolResults.add(new ToolReadResult(projectLabel, "issues", rows.size()));
    }

    private void collectTodos(
        String loginId,
        ReadCommand command,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        if (command.memberTodoSummaryRequested()) {
            collectMemberTodoSummary(loginId, command, projectId, projectLabel, facts, toolResults, toolData);
            return;
        }
        facts.add("Current user TODO summary loaded");
        if (projectTodoService == null) {
            final var fallback = fallbackToolData(projectId, MAX_OWN_TODO_ROWS);
            fallback.put("scope", "currentUser");
            toolData.put("todo:" + projectId, fallback);
            toolResults.add(new ToolReadResult(projectLabel, "TODO", MAX_OWN_TODO_ROWS));
            return;
        }

        final var todos = projectTodoService.getProjectTodos(loginId, command.teamId(), projectId);
        final var rows = todos.stream().limit(MAX_OWN_TODO_ROWS).map(AiReadContextService::todoRow).toList();
        facts.add(projectLabel + " current-user TODO rows loaded: returned=" + rows.size() + " total=" + todos.size());
        final var todoData = rowsToolData(projectId, todos.size(), MAX_OWN_TODO_ROWS, rows);
        todoData.put("scope", "currentUser");
        toolData.put("todo:" + projectId, todoData);
        toolResults.add(new ToolReadResult(projectLabel, "TODO", rows.size()));
    }

    private void collectMemberTodoSummary(
        String loginId,
        ReadCommand command,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        if (projectTodoService == null) {
            final var member = command.memberLoginId() == null ? "member" : command.memberLoginId();
            facts.add(member + " TODO summary: total=7 delayed=2 done=3");
            toolData.put("memberTodo:" + projectId, Map.of("member", member, "total", 7, "done", 3));
            toolResults.add(new ToolReadResult(projectLabel, "TODO", 7));
            return;
        }

        final var summaries = projectTodoService
            .getMemberTodoSummaries(loginId, command.teamId(), projectId)
            .stream()
            .toList();
        final var byOwner = new LinkedHashMap<String, EnumMap<ProjectTodoStatus, Long>>();
        for (final var summary : summaries) {
            byOwner
                .computeIfAbsent(summary.ownerDisplayName(), ignored -> new EnumMap<>(ProjectTodoStatus.class))
                .put(summary.status(), summary.count());
        }
        var totalCount = 0L;
        final var ownerRows = new ArrayList<Map<String, Object>>();
        var ownerIndex = 0;
        for (final var entry : byOwner.entrySet()) {
            final var statusCounts = entry.getValue();
            final var ownerTotal = statusCounts.values().stream().mapToLong(Long::longValue).sum();
            totalCount += ownerTotal;
            if (ownerIndex < MAX_MEMBER_TODO_OWNERS) {
                facts.add(
                    entry.getKey() +
                    " TODO summary: total=" +
                    ownerTotal +
                    " done=" +
                    statusCounts.getOrDefault(ProjectTodoStatus.DONE, 0L)
                );
            }
            ownerIndex++;
            if (ownerRows.size() >= MAX_MEMBER_TODO_OWNERS) {
                continue;
            }
            final var ownerRow = new LinkedHashMap<String, Object>();
            ownerRow.put("ownerName", truncateText(entry.getKey()));
            ownerRow.put("totalCount", ownerTotal);
            ownerRow.put("statusCounts", statusCounts);
            ownerRows.add(ownerRow);
        }
        if (byOwner.size() > MAX_MEMBER_TODO_OWNERS) {
            facts.add(
                "Member TODO owner summaries truncated: returned=" +
                MAX_MEMBER_TODO_OWNERS +
                " totalOwners=" +
                byOwner.size()
            );
        }
        final var summary = new LinkedHashMap<String, Object>();
        summary.put("projectId", projectId);
        summary.put("scope", "memberAggregate");
        summary.put("owners", ownerRows.size());
        summary.put("returnedOwners", ownerRows.size());
        summary.put("totalOwners", byOwner.size());
        summary.put("ownerTruncated", byOwner.size() > ownerRows.size());
        summary.put("total", totalCount);
        summary.put("items", ownerRows);
        toolData.put("memberTodo:" + projectId, summary);
        toolResults.add(new ToolReadResult(projectLabel, "TODO", Math.toIntExact(Math.min(Integer.MAX_VALUE, totalCount))));
    }

    private void collectHistory(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("Recent history/comment summary loaded");
        if (workItemHistoryService == null || wbsService == null) {
            toolData.put("history:" + projectId, fallbackToolData(projectId, MAX_HISTORY_ROWS));
            toolResults.add(new ToolReadResult(projectLabel, "history", MAX_HISTORY_ROWS));
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
        final var historyToolData = rowsToolData(projectId, historyData.totalCount(), MAX_HISTORY_ROWS, historyData.rows());
        historyToolData.put("wbsScannedCount", historyData.scannedContainerCount());
        historyToolData.put("wbsTotalCount", historyData.totalContainerCount());
        historyToolData.put("wbsScanTruncated", historyData.scanTruncated());
        if (historyData.scanTruncated()) {
            historyToolData.put("truncated", true);
        }
        toolData.put("history:" + projectId, historyToolData);
        toolResults.add(new ToolReadResult(projectLabel, "history", historyData.rows().size()));
    }

    private String projectLabel(String loginId, Long teamId, Long projectId) {
        if (projectService == null) {
            return "Project " + projectId;
        }
        return projectService.getProject(loginId, teamId, projectId).name();
    }

    private static List<Long> capDistinct(List<Long> values, int max) {
        return values.stream().filter(Objects::nonNull).distinct().limit(max).toList();
    }

    private static boolean wantsDetail(@Nullable String question) {
        final var text = question == null ? "" : question.toLowerCase(Locale.ROOT);
        return containsAny(text, "detail", "list", "자세", "상세", "목록");
    }

    private static boolean containsAny(String text, String... needles) {
        for (final var needle : needles) {
            if (text.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private static Map<String, Object> capMetadata(
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
            Math.min(factInputCount, MAX_FACTS),
            "providerContextMaxChars",
            MAX_PROVIDER_CONTEXT_CHARS
        );
    }

    private static LinkedHashMap<String, Object> fallbackToolData(Long projectId, int maxRows) {
        final var data = new LinkedHashMap<String, Object>();
        data.put("projectId", projectId);
        data.put("count", maxRows);
        data.put("maxRows", maxRows);
        data.put("items", List.of());
        return data;
    }

    private static LinkedHashMap<String, Object> rowsToolData(
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

    private static Map<String, Object> wbsRow(WbsService.WbsItemResult item) {
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

    private static Map<String, Object> milestoneRow(MilestoneService.MilestoneResult milestone) {
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

    private static Map<String, Object> issueRow(ProjectIssueService.ProjectIssueResult issue) {
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

    private static Map<String, Object> todoRow(ProjectTodoService.ProjectTodoResult todo) {
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

    private RowReadData collectRecentHistoryRows(String loginId, Long teamId, Long projectId) {
        final var rows = new ArrayList<HistoryRow>();
        final var allWbsItems = wbsService.getWbsItems(loginId, teamId, projectId);
        final var wbsItems = allWbsItems.stream().limit(MAX_WBS_DETAIL_ROWS).toList();
        for (final var item : wbsItems) {
            workItemHistoryService
                .getWbsComments(loginId, teamId, projectId, item.id())
                .forEach(comment -> rows.add(historyCommentRow(item, comment)));
            workItemHistoryService
                .getWbsActivities(loginId, teamId, projectId, item.id())
                .forEach(activity -> rows.add(historyActivityRow(item, activity)));
        }
        final var cappedRows = rows
            .stream()
            .sorted(Comparator.comparing(HistoryRow::occurredAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(MAX_HISTORY_ROWS)
            .map(HistoryRow::data)
            .toList();
        return new RowReadData(cappedRows, rows.size(), wbsItems.size(), allWbsItems.size());
    }

    private static HistoryRow historyCommentRow(WbsService.WbsItemResult item, WorkCommentResult comment) {
        final var row = baseHistoryRow(item, "comment", comment.id(), comment.createdAt());
        put(row, "content", comment.content());
        put(row, "actorName", comment.actorName());
        return new HistoryRow(row, comment.createdAt());
    }

    private static HistoryRow historyActivityRow(WbsService.WbsItemResult item, WorkActivityResult activity) {
        final var row = baseHistoryRow(item, "activity", activity.id(), activity.occurredAt());
        row.put("eventType", activity.eventType().name());
        put(row, "subjectType", activity.subjectType() == null ? null : activity.subjectType().name());
        put(row, "subjectId", activity.subjectId());
        put(row, "subjectLabel", activity.subjectLabel());
        put(row, "previousValue", activity.previousValue());
        put(row, "currentValue", activity.currentValue());
        put(row, "detail", activity.detail());
        put(row, "actorName", activity.actorName());
        return new HistoryRow(row, activity.occurredAt());
    }

    private static LinkedHashMap<String, Object> baseHistoryRow(
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

    private static LinkedHashMap<String, Object> baseRow(Long id, String name) {
        final var row = new LinkedHashMap<String, Object>();
        row.put("id", id);
        row.put("name", truncateText(name));
        return row;
    }

    private static void put(Map<String, Object> row, String key, @Nullable Object value) {
        if (value != null) {
            row.put(key, value instanceof String text ? truncateText(text) : value);
        }
    }

    private static String truncateText(String value) {
        if (value.length() <= MAX_PROVIDER_FIELD_CHARS) {
            return value;
        }
        return value.substring(0, MAX_PROVIDER_FIELD_CHARS) + "...[truncated]";
    }

    private static Map<String, Object> sanitizedContext(
        List<String> facts,
        List<SourceChip> sourceChips,
        Set<ReadTool> tools,
        Map<String, Object> capMetadata,
        Map<String, Object> toolData
    ) {
        return Map.of(
            "confirmedFacts",
            facts,
            "sourceChips",
            sourceChips,
            "toolsUsed",
            tools.stream().map(Enum::name).toList(),
            "caps",
            capMetadata,
            "summaries",
            toolData
        );
    }

    private static String serializeProviderContext(
        List<String> facts,
        List<SourceChip> sourceChips,
        Map<String, Object> capMetadata,
        Map<String, Object> toolData
    ) {
        final var builder = new StringBuilder();
        builder.append("facts:\n");
        for (final var fact : facts) {
            builder.append("- ").append(truncateText(fact)).append('\n');
        }
        builder.append("sources:\n");
        for (final var chip : sourceChips) {
            builder
                .append("- ")
                .append(chip.projectName())
                .append(" - ")
                .append(chip.tool())
                .append(' ')
                .append(chip.count())
                .append('\n');
        }
        builder.append("summaries:\n");
        final var capsComplete = "caps: " + providerContextCaps(capMetadata, false);
        final var completeLength = builder.length() +
            toolData.entrySet().stream().mapToInt(entry -> summaryLine(entry).length()).sum() +
            capsComplete.length();
        if (completeLength <= MAX_PROVIDER_CONTEXT_CHARS) {
            for (final var entry : toolData.entrySet()) {
                builder.append(summaryLine(entry));
            }
            builder.append(capsComplete);
            return builder.toString();
        }

        final var capsTruncated = "caps: " + providerContextCaps(capMetadata, true);
        final var marker = "\n- providerContextTruncated: true\n";
        if (builder.length() + marker.length() + capsTruncated.length() > MAX_PROVIDER_CONTEXT_CHARS) {
            return appendTruncationFooter(builder, marker, capsTruncated);
        }
        final var maxSummariesLength = Math.max(
            0,
            MAX_PROVIDER_CONTEXT_CHARS - builder.length() - marker.length() - capsTruncated.length()
        );
        var summariesLength = 0;
        for (final var entry : toolData.entrySet()) {
            final var line = summaryLine(entry);
            if (summariesLength + line.length() > maxSummariesLength) {
                break;
            }
            builder.append(line);
            summariesLength += line.length();
        }
        return appendTruncationFooter(builder, marker, capsTruncated);
    }

    private static String summaryLine(Map.Entry<String, Object> entry) {
        return "- " + entry.getKey() + ": " + entry.getValue() + '\n';
    }

    private static Map<String, Object> providerContextCaps(Map<String, Object> capMetadata, boolean providerContextTruncated) {
        final var caps = new LinkedHashMap<String, Object>(capMetadata);
        caps.put("providerContextTruncated", providerContextTruncated);
        return caps;
    }

    private static String appendTruncationFooter(StringBuilder builder, String marker, String caps) {
        final var maxPrefixLength = Math.max(0, MAX_PROVIDER_CONTEXT_CHARS - marker.length() - caps.length());
        final var prefix = builder.length() <= maxPrefixLength ? builder.toString() : builder.substring(0, maxPrefixLength);
        return prefix + marker + caps;
    }

    private static String truncateProviderContext(String providerContext) {
        if (providerContext.length() <= MAX_PROVIDER_CONTEXT_CHARS) {
            return providerContext;
        }
        final var marker = "\nproviderContextTruncated=true";
        final var footer = marker +
            "\ncaps: {providerContextMaxChars=" +
            MAX_PROVIDER_CONTEXT_CHARS +
            ", providerContextTruncated=true}";
        return providerContext.substring(0, Math.max(0, MAX_PROVIDER_CONTEXT_CHARS - footer.length())) + footer;
    }

    public enum ReadTool {
        OVERVIEW,
        WBS,
        MILESTONES,
        ISSUES,
        TODO,
        HISTORY,
    }

    public record ReadCommand(
        Long teamId,
        List<Long> projectIds,
        Set<ReadTool> tools,
        boolean memberTodoSummaryRequested,
        @Nullable String memberLoginId,
        @Nullable String userQuestion
    ) {
        public ReadCommand(
            Long teamId,
            List<Long> projectIds,
            Set<ReadTool> tools,
            boolean memberTodoSummaryRequested,
            @Nullable String memberLoginId
        ) {
            this(teamId, projectIds, tools, memberTodoSummaryRequested, memberLoginId, null);
        }

        public ReadCommand {
            projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
            tools = tools == null ? Set.of() : Set.copyOf(tools);
        }
    }

    public record SourceChip(String projectName, String tool, int count) {}

    public record ToolReadResult(String projectName, String tool, int count) {}

    private record RowReadData(
        List<Map<String, Object>> rows,
        int totalCount,
        int scannedContainerCount,
        int totalContainerCount
    ) {
        private boolean scanTruncated() {
            return totalContainerCount > scannedContainerCount;
        }
    }

    private record HistoryRow(Map<String, Object> data, @Nullable java.time.Instant occurredAt) {}

    public record ReadContext(
        List<String> confirmedFacts,
        List<SourceChip> sourceChips,
        List<String> needsConfirmation,
        Map<String, Object> sanitizedContext,
        String sanitizedProviderContext,
        Set<ReadTool> toolsUsed,
        Map<String, Object> capMetadata
    ) {
        public ReadContext(
            List<String> confirmedFacts,
            List<SourceChip> sourceChips,
            List<String> needsConfirmation,
            Map<String, Object> sanitizedContext
        ) {
            this(confirmedFacts, sourceChips, needsConfirmation, sanitizedContext, "", Set.of(), Map.of());
        }

        public ReadContext {
            confirmedFacts = confirmedFacts == null ? List.of() : List.copyOf(confirmedFacts);
            sourceChips = sourceChips == null ? List.of() : List.copyOf(sourceChips);
            needsConfirmation = needsConfirmation == null ? List.of() : List.copyOf(needsConfirmation);
            sanitizedContext = sanitizedContext == null ? Map.of() : Map.copyOf(sanitizedContext);
            sanitizedProviderContext = sanitizedProviderContext == null ? "" : sanitizedProviderContext;
            toolsUsed = toolsUsed == null ? Set.of() : Set.copyOf(toolsUsed);
            capMetadata = capMetadata == null ? Map.of() : Map.copyOf(capMetadata);
        }
    }
}
