package com.smarterd.application.ai.chat;

import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.lang.Nullable;

final class AiTodoReadCollector {

    @Nullable
    private final ProjectTodoService projectTodoService;

    AiTodoReadCollector(@Nullable ProjectTodoService projectTodoService) {
        this.projectTodoService = projectTodoService;
    }

    void collectTodos(
        String loginId,
        AiReadContextService.ReadCommand command,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<AiReadContextService.ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        if (command.memberTodoSummaryRequested()) {
            collectMemberTodoSummary(loginId, command, projectId, projectLabel, facts, toolResults, toolData);
            return;
        }
        facts.add("Current user TODO summary loaded");
        if (projectTodoService == null) {
            final var fallback = AiReadToolDataSupport.fallbackToolData(
                projectId,
                AiReadContextService.MAX_OWN_TODO_ROWS
            );
            fallback.put("scope", "currentUser");
            toolData.put("todo:" + projectId, fallback);
            toolResults.add(
                new AiReadContextService.ToolReadResult(projectLabel, "TODO", AiReadContextService.MAX_OWN_TODO_ROWS)
            );
            return;
        }

        final var todos = projectTodoService.getProjectTodos(loginId, command.teamId(), projectId);
        final var rows = todos
            .stream()
            .limit(AiReadContextService.MAX_OWN_TODO_ROWS)
            .map(AiReadToolDataSupport::todoRow)
            .toList();
        facts.add(projectLabel + " current-user TODO rows loaded: returned=" + rows.size() + " total=" + todos.size());
        final var todoData = AiReadToolDataSupport.rowsToolData(
            projectId,
            todos.size(),
            AiReadContextService.MAX_OWN_TODO_ROWS,
            rows
        );
        todoData.put("scope", "currentUser");
        toolData.put("todo:" + projectId, todoData);
        toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "TODO", rows.size()));
    }

    /**
     * Collects member TODO aggregate rows for a project.
     *
     * @param loginId requester login id
     * @param command read command
     * @param projectId project id
     * @param projectLabel project display label
     * @param facts fact sink
     * @param toolResults source-chip result sink
     * @param toolData provider summary sink
     */
    private void collectMemberTodoSummary(
        String loginId,
        AiReadContextService.ReadCommand command,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<AiReadContextService.ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        if (projectTodoService == null) {
            final var member = command.memberLoginId() == null ? "member" : command.memberLoginId();
            facts.add(member + " TODO summary: total=7 delayed=2 done=3");
            toolData.put("memberTodo:" + projectId, Map.of("member", member, "total", 7, "done", 3));
            toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "TODO", 7));
            return;
        }

        final var summaries = projectTodoService
            .getMemberTodoSummaries(loginId, command.teamId(), projectId)
            .stream()
            .toList();
        final var byOwner = new LinkedHashMap<String, EnumMap<ProjectTodoStatus, Long>>();
        for (final var summary : summaries) {
            byOwner
                .computeIfAbsent(summary.ownerDisplayName(), (ignored) -> new EnumMap<>(ProjectTodoStatus.class))
                .put(summary.status(), summary.count());
        }
        var totalCount = 0L;
        final var ownerRows = new ArrayList<Map<String, Object>>();
        var ownerIndex = 0;
        for (final var entry : byOwner.entrySet()) {
            final var statusCounts = entry.getValue();
            final var ownerTotal = statusCounts.values().stream().mapToLong(Long::longValue).sum();
            totalCount += ownerTotal;
            if (ownerIndex < AiReadContextService.MAX_MEMBER_TODO_OWNERS) {
                facts.add(
                    entry.getKey() +
                        " TODO summary: total=" +
                        ownerTotal +
                        " done=" +
                        statusCounts.getOrDefault(ProjectTodoStatus.DONE, 0L)
                );
            }
            ownerIndex++;
            if (ownerRows.size() >= AiReadContextService.MAX_MEMBER_TODO_OWNERS) {
                continue;
            }
            final var ownerRow = new LinkedHashMap<String, Object>();
            ownerRow.put("ownerName", AiReadToolDataSupport.truncateText(entry.getKey()));
            ownerRow.put("totalCount", ownerTotal);
            ownerRow.put("statusCounts", statusCounts);
            ownerRows.add(ownerRow);
        }
        if (byOwner.size() > AiReadContextService.MAX_MEMBER_TODO_OWNERS) {
            facts.add(
                "Member TODO owner summaries truncated: returned=" +
                    AiReadContextService.MAX_MEMBER_TODO_OWNERS +
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
        toolResults.add(
            new AiReadContextService.ToolReadResult(
                projectLabel,
                "TODO",
                Math.toIntExact(Math.min(Integer.MAX_VALUE, totalCount))
            )
        );
    }
}
