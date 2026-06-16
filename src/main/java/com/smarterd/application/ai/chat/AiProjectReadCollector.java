package com.smarterd.application.ai.chat;

import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import com.smarterd.domain.pm.milestone.service.MilestoneService;
import com.smarterd.domain.pm.wbs.service.WbsService;
import com.smarterd.domain.project.service.ProjectService;
import java.util.List;
import java.util.Map;
import org.springframework.lang.Nullable;

final class AiProjectReadCollector {

    @Nullable
    private final ProjectService projectService;

    @Nullable
    private final WbsService wbsService;

    @Nullable
    private final MilestoneService milestoneService;

    @Nullable
    private final ProjectIssueService projectIssueService;

    AiProjectReadCollector(
        @Nullable ProjectService projectService,
        @Nullable WbsService wbsService,
        @Nullable MilestoneService milestoneService,
        @Nullable ProjectIssueService projectIssueService
    ) {
        this.projectService = projectService;
        this.wbsService = wbsService;
        this.milestoneService = milestoneService;
        this.projectIssueService = projectIssueService;
    }

    void collectOverview(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<AiReadContextService.ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("Project overview summary loaded");
        if (projectService == null) {
            toolData.put("overview:" + projectId, Map.of("projectId", projectId, "projectName", projectLabel));
            toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "overview", 1));
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
        toolResults.add(new AiReadContextService.ToolReadResult(overview.projectName(), "overview", 1));
    }

    void collectWbs(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        @Nullable String question,
        List<String> facts,
        List<AiReadContextService.ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("WBS risk summary loaded");
        final var maxRows = AiReadToolSelector.wantsDetail(question)
            ? AiReadContextService.MAX_WBS_DETAIL_ROWS
            : AiReadContextService.MAX_WBS_SUMMARY_ROWS;
        if (wbsService == null) {
            toolData.put("wbs:" + projectId, AiReadToolDataSupport.fallbackToolData(projectId, maxRows));
            toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "WBS", maxRows));
            return;
        }

        final var wbsItems = wbsService.getWbsItems(loginId, teamId, projectId);
        final var rows = wbsItems.stream().limit(maxRows).map(AiReadToolDataSupport::wbsRow).toList();
        facts.add(projectLabel + " WBS rows loaded: returned=" + rows.size() + " total=" + wbsItems.size());
        toolData.put("wbs:" + projectId, AiReadToolDataSupport.rowsToolData(projectId, wbsItems.size(), maxRows, rows));
        toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "WBS", rows.size()));
    }

    void collectMilestones(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        List<String> facts,
        List<AiReadContextService.ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("Milestone delay summary loaded");
        if (milestoneService == null) {
            toolData.put(
                "milestones:" + projectId,
                AiReadToolDataSupport.fallbackToolData(projectId, AiReadContextService.MAX_MILESTONE_ROWS)
            );
            toolResults.add(
                new AiReadContextService.ToolReadResult(
                    projectLabel,
                    "milestones",
                    AiReadContextService.MAX_MILESTONE_ROWS
                )
            );
            return;
        }

        final var milestones = milestoneService.getMilestones(loginId, teamId, projectId);
        final var rows = milestones
            .stream()
            .limit(AiReadContextService.MAX_MILESTONE_ROWS)
            .map(AiReadToolDataSupport::milestoneRow)
            .toList();
        facts.add(projectLabel + " milestone rows loaded: returned=" + rows.size() + " total=" + milestones.size());
        toolData.put(
            "milestones:" + projectId,
            AiReadToolDataSupport.rowsToolData(
                projectId,
                milestones.size(),
                AiReadContextService.MAX_MILESTONE_ROWS,
                rows
            )
        );
        toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "milestones", rows.size()));
    }

    void collectIssues(
        String loginId,
        Long teamId,
        Long projectId,
        String projectLabel,
        @Nullable String question,
        List<String> facts,
        List<AiReadContextService.ToolReadResult> toolResults,
        Map<String, Object> toolData
    ) {
        facts.add("Issue status summary loaded");
        final var maxRows = AiReadToolSelector.wantsDetail(question)
            ? AiReadContextService.MAX_ISSUE_DETAIL_ROWS
            : AiReadContextService.MAX_ISSUE_SUMMARY_ROWS;
        if (projectIssueService == null) {
            toolData.put("issues:" + projectId, AiReadToolDataSupport.fallbackToolData(projectId, maxRows));
            toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "issues", maxRows));
            return;
        }

        final var issues = projectIssueService.getProjectIssues(loginId, teamId, projectId, null);
        final var rows = issues.stream().limit(maxRows).map(AiReadToolDataSupport::issueRow).toList();
        facts.add(projectLabel + " issue rows loaded: returned=" + rows.size() + " total=" + issues.size());
        toolData.put(
            "issues:" + projectId,
            AiReadToolDataSupport.rowsToolData(projectId, issues.size(), maxRows, rows)
        );
        toolResults.add(new AiReadContextService.ToolReadResult(projectLabel, "issues", rows.size()));
    }

    String projectLabel(String loginId, Long teamId, Long projectId) {
        if (projectService == null) {
            return "Project " + projectId;
        }
        return projectService.getProject(loginId, teamId, projectId).name();
    }
}
