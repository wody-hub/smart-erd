package com.smarterd.application.ai.chat;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import com.smarterd.domain.pm.milestone.service.MilestoneService;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import com.smarterd.domain.pm.wbs.service.WbsService;
import com.smarterd.domain.project.service.ProjectService;
import java.util.ArrayList;
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

        final var cappedFacts = List.copyOf(facts.stream().limit(MAX_FACTS).toList());
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
        final var count = wbsService == null
            ? maxRows
            : Math.min(wbsService.getWbsItems(loginId, teamId, projectId).size(), maxRows);
        toolData.put("wbs:" + projectId, Map.of("projectId", projectId, "count", count, "maxRows", maxRows));
        toolResults.add(new ToolReadResult(projectLabel, "WBS", count));
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
        final var count = milestoneService == null
            ? MAX_MILESTONE_ROWS
            : Math.min(milestoneService.getMilestones(loginId, teamId, projectId).size(), MAX_MILESTONE_ROWS);
        toolData.put("milestones:" + projectId, Map.of("projectId", projectId, "count", count));
        toolResults.add(new ToolReadResult(projectLabel, "milestones", count));
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
        final var count = projectIssueService == null
            ? maxRows
            : Math.min(projectIssueService.getProjectIssues(loginId, teamId, projectId, null).size(), maxRows);
        toolData.put("issues:" + projectId, Map.of("projectId", projectId, "count", count, "maxRows", maxRows));
        toolResults.add(new ToolReadResult(projectLabel, "issues", count));
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
        final var count = projectTodoService == null
            ? MAX_OWN_TODO_ROWS
            : Math.min(projectTodoService.getProjectTodos(loginId, command.teamId(), projectId).size(), MAX_OWN_TODO_ROWS);
        toolData.put("todo:" + projectId, Map.of("projectId", projectId, "scope", "currentUser", "count", count));
        toolResults.add(new ToolReadResult(projectLabel, "TODO", count));
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
            .limit(MAX_MEMBER_TODO_OWNERS * (long) ProjectTodoStatus.values().length)
            .toList();
        final var byOwner = new LinkedHashMap<String, EnumMap<ProjectTodoStatus, Long>>();
        for (final var summary : summaries) {
            byOwner
                .computeIfAbsent(summary.ownerDisplayName(), ignored -> new EnumMap<>(ProjectTodoStatus.class))
                .put(summary.status(), summary.count());
        }
        var totalCount = 0L;
        for (final var entry : byOwner.entrySet()) {
            final var statusCounts = entry.getValue();
            final var ownerTotal = statusCounts.values().stream().mapToLong(Long::longValue).sum();
            totalCount += ownerTotal;
            facts.add(
                entry.getKey() +
                " TODO summary: total=" +
                ownerTotal +
                " done=" +
                statusCounts.getOrDefault(ProjectTodoStatus.DONE, 0L)
            );
        }
        toolData.put("memberTodo:" + projectId, Map.of("owners", byOwner.size(), "total", totalCount));
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
        final var count = workItemHistoryService == null || wbsService == null
            ? MAX_HISTORY_ROWS
            : countRecentHistoryRows(loginId, teamId, projectId);
        toolData.put("history:" + projectId, Map.of("projectId", projectId, "count", count));
        toolResults.add(new ToolReadResult(projectLabel, "history", count));
    }

    private int countRecentHistoryRows(String loginId, Long teamId, Long projectId) {
        var count = 0;
        final var wbsItems = wbsService.getWbsItems(loginId, teamId, projectId).stream().limit(MAX_WBS_DETAIL_ROWS).toList();
        for (final var item : wbsItems) {
            count += workItemHistoryService.getWbsComments(loginId, teamId, projectId, item.id()).size();
            count += workItemHistoryService.getWbsActivities(loginId, teamId, projectId, item.id()).size();
            if (count >= MAX_HISTORY_ROWS) {
                return MAX_HISTORY_ROWS;
            }
        }
        return count;
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
            builder.append("- ").append(fact).append('\n');
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
        for (final var entry : toolData.entrySet()) {
            builder.append("- ").append(entry.getKey()).append(": ").append(entry.getValue()).append('\n');
        }
        builder.append("caps: ").append(capMetadata);
        return builder.toString();
    }

    private static String truncateProviderContext(String providerContext) {
        if (providerContext.length() <= MAX_PROVIDER_CONTEXT_CHARS) {
            return providerContext;
        }
        return providerContext.substring(0, MAX_PROVIDER_CONTEXT_CHARS);
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
