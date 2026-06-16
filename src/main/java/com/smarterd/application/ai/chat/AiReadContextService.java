package com.smarterd.application.ai.chat;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import com.smarterd.domain.pm.milestone.service.MilestoneService;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import com.smarterd.domain.pm.wbs.service.WbsService;
import com.smarterd.domain.project.service.ProjectService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    private final AiProjectReadCollector projectCollector;
    private final AiTodoReadCollector todoCollector;
    private final AiHistoryReadCollector historyCollector;
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
        this.projectCollector = new AiProjectReadCollector(
            projectService,
            wbsService,
            milestoneService,
            projectIssueService
        );
        this.todoCollector = new AiTodoReadCollector(projectTodoService);
        this.historyCollector = new AiHistoryReadCollector(wbsService, workItemHistoryService);
        this.sourceChipFactory = sourceChipFactory;
    }

    public ReadContext read(String loginId, ReadCommand command) {
        final var selectedTools = command.tools().isEmpty() ? selectTools(command.userQuestion()) : command.tools();
        final var projectIds = AiReadToolDataSupport.capDistinct(command.projectIds(), MAX_TEAM_PROJECTS);
        final var detailedProjectIds = AiReadToolDataSupport.capDistinct(projectIds, MAX_DETAILED_PROJECTS);
        final var facts = new ArrayList<String>();
        final var toolResults = new ArrayList<ToolReadResult>();
        final var toolData = new LinkedHashMap<String, Object>();

        for (final var projectId : detailedProjectIds) {
            final var projectLabel = projectCollector.projectLabel(loginId, command.teamId(), projectId);
            if (selectedTools.contains(ReadTool.OVERVIEW)) {
                projectCollector.collectOverview(
                    loginId,
                    command.teamId(),
                    projectId,
                    projectLabel,
                    facts,
                    toolResults,
                    toolData
                );
            }
            if (selectedTools.contains(ReadTool.WBS)) {
                projectCollector.collectWbs(
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
                projectCollector.collectMilestones(
                    loginId,
                    command.teamId(),
                    projectId,
                    projectLabel,
                    facts,
                    toolResults,
                    toolData
                );
            }
            if (selectedTools.contains(ReadTool.ISSUES)) {
                projectCollector.collectIssues(
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
                todoCollector.collectTodos(loginId, command, projectId, projectLabel, facts, toolResults, toolData);
            }
            if (selectedTools.contains(ReadTool.HISTORY)) {
                historyCollector.collectHistory(
                    loginId,
                    command.teamId(),
                    projectId,
                    projectLabel,
                    facts,
                    toolResults,
                    toolData
                );
            }
        }

        final var cappedFacts = List.copyOf(
            facts.stream().limit(MAX_FACTS).map(AiReadToolDataSupport::truncateText).toList()
        );
        final var capMetadata = AiReadToolDataSupport.capMetadata(
            command.projectIds().size(),
            projectIds.size(),
            detailedProjectIds.size(),
            facts.size()
        );
        final var sourceChips = sourceChipFactory.fromToolResults(toolResults);
        final var sanitizedContext = AiReadProviderContextFormatter.sanitizedContext(
            cappedFacts,
            sourceChips,
            selectedTools,
            capMetadata,
            toolData
        );
        final var providerContext = AiReadProviderContextFormatter.truncateProviderContext(
            AiReadProviderContextFormatter.serializeProviderContext(cappedFacts, sourceChips, capMetadata, toolData)
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
        return AiReadToolSelector.selectTools(question);
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
