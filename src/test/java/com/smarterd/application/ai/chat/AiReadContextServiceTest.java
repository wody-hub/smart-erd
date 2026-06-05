package com.smarterd.application.ai.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.pm.history.entity.WorkActivityEventType;
import com.smarterd.domain.pm.history.entity.WorkActivitySubjectType;
import com.smarterd.domain.pm.history.entity.WorkTargetType;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import com.smarterd.domain.pm.milestone.entity.MilestoneType;
import com.smarterd.domain.pm.milestone.service.MilestoneService;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import com.smarterd.domain.pm.wbs.service.WbsService;
import com.smarterd.domain.project.service.ProjectService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.LongStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiReadContextServiceTest {

    private final AiReadContextService readContextService = new AiReadContextService();

    @Mock
    private ProjectTodoService projectTodoService;

    @Mock
    private ProjectService projectService;

    @Mock
    private WbsService wbsService;

    @Mock
    private MilestoneService milestoneService;

    @Mock
    private ProjectIssueService projectIssueService;

    @Mock
    private WorkItemHistoryService workItemHistoryService;

    @Test
    @DisplayName("10-W0-02 overview WBS milestone issue TODO and history summaries are source backed")
    void w0_10_W0_02_summaryFirstReadToolsReturnFactsAndSourceChips() {
        when(projectService.getProject("tester", 1L, 10L))
            .thenReturn(new ProjectService.ProjectResult(10L, "Alpha", "", 1L, null, null));
        when(projectService.getBusinessOverview("tester", 1L, 10L))
            .thenReturn(new ProjectService.BusinessOverviewResult(10L, "Alpha", null, null, null, null, null, null, 5L, 2L, 40));
        final var service = new AiReadContextService(projectService, null, null, null, null, null, new AiSourceChipFactory());

        final var result = service.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L),
                Set.of(
                    AiReadContextService.ReadTool.OVERVIEW,
                    AiReadContextService.ReadTool.WBS,
                    AiReadContextService.ReadTool.MILESTONES,
                    AiReadContextService.ReadTool.ISSUES,
                    AiReadContextService.ReadTool.TODO,
                    AiReadContextService.ReadTool.HISTORY
                ),
                false,
                null
            )
        );

        assertThat(result.confirmedFacts())
            .contains(
                "Project overview summary loaded",
                "WBS risk summary loaded",
                "Milestone delay summary loaded",
                "Issue status summary loaded",
                "Current user TODO summary loaded",
                "Recent history/comment summary loaded"
            );
        assertThat(result.sourceChips())
            .extracting(AiReadContextService.SourceChip::tool)
            .containsExactlyInAnyOrder("overview", "WBS", "milestones", "issues", "TODO", "history");
        assertThat(result.sanitizedProviderContext())
            .contains("summaries:")
            .contains("overview:10")
            .contains("memberCount")
            .contains("wbs:10")
            .contains("milestones:10")
            .contains("issues:10")
            .contains("todo:10")
            .contains("scope=currentUser")
            .contains("history:10")
            .doesNotContain("tester")
            .doesNotContain("rawPrompt")
            .doesNotContain("rawProviderOutput")
            .doesNotContain("accessToken")
            .doesNotContain("refreshToken")
            .doesNotContain("cookie")
            .doesNotContain("password")
            .doesNotContain("stdout")
            .doesNotContain("stderr");
        assertThat(result.sanitizedProviderContext()).hasSizeLessThanOrEqualTo(
            AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS
        );
    }

    @Test
    @DisplayName("10-02 Korean and SI PM question text selects read tools deterministically")
    void koreanAndSiPmQuestionTextSelectsReadTools() {
        final var tools = readContextService.selectTools(
            "WBS 작업 지연, 마일스톤 일정, 이슈 리스크, TODO 할 일, 코멘트 히스토리와 미완료 항목을 요약해줘"
        );

        assertThat(tools)
            .containsExactlyInAnyOrder(
                AiReadContextService.ReadTool.WBS,
                AiReadContextService.ReadTool.MILESTONES,
                AiReadContextService.ReadTool.ISSUES,
                AiReadContextService.ReadTool.TODO,
                AiReadContextService.ReadTool.HISTORY
            );
    }

    @Test
    @DisplayName("13-01 detailed read context serializes authorized rows for provider grounding")
    void detailedReadContextSerializesAuthorizedRowsForProviderGrounding() {
        when(projectService.getProject("tester", 1L, 10L))
            .thenReturn(new ProjectService.ProjectResult(10L, "Alpha", "", 1L, null, null));
        when(wbsService.getWbsItems("tester", 1L, 10L)).thenReturn(List.of(sampleWbs()));
        when(milestoneService.getMilestones("tester", 1L, 10L)).thenReturn(List.of(sampleMilestone()));
        when(projectIssueService.getProjectIssues("tester", 1L, 10L, null)).thenReturn(List.of(sampleIssue()));
        when(projectTodoService.getProjectTodos("tester", 1L, 10L)).thenReturn(List.of(sampleTodo()));
        when(workItemHistoryService.getWbsComments("tester", 1L, 10L, 100L)).thenReturn(List.of(sampleComment()));
        when(workItemHistoryService.getWbsActivities("tester", 1L, 10L, 100L)).thenReturn(List.of(sampleActivity()));
        final var service = new AiReadContextService(
            projectService,
            wbsService,
            milestoneService,
            projectIssueService,
            projectTodoService,
            workItemHistoryService,
            new AiSourceChipFactory()
        );

        final var result = service.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L),
                Set.of(
                    AiReadContextService.ReadTool.WBS,
                    AiReadContextService.ReadTool.MILESTONES,
                    AiReadContextService.ReadTool.ISSUES,
                    AiReadContextService.ReadTool.TODO,
                    AiReadContextService.ReadTool.HISTORY
                ),
                false,
                null,
                "상세 목록과 최근 댓글을 알려줘"
            )
        );

        assertThat(result.sanitizedProviderContext())
            .contains("items=[")
            .contains("화면 설계")
            .contains("홍길동")
            .contains("Kickoff")
            .contains("장애 대응")
            .contains("내 할 일")
            .contains("댓글 내용")
            .contains("DOCUMENT_LINKED")
            .contains("truncated=false")
            .contains("targetName=화면 설계")
            .doesNotContain("assigneeLoginId")
            .doesNotContain("actorLoginId")
            .doesNotContain("tester");
        assertThat(result.sourceChips())
            .extracting(AiReadContextService.SourceChip::tool)
            .containsExactlyInAnyOrder("WBS", "milestones", "issues", "TODO", "history");
    }

    @Test
    @DisplayName("13-01 history detail reports truncation when returned rows are capped")
    void historyDetailReportsTruncationWhenRowsAreCapped() {
        when(projectService.getProject("tester", 1L, 10L))
            .thenReturn(new ProjectService.ProjectResult(10L, "Alpha", "", 1L, null, null));
        when(wbsService.getWbsItems("tester", 1L, 10L)).thenReturn(List.of(sampleWbs()));
        when(workItemHistoryService.getWbsComments("tester", 1L, 10L, 100L)).thenReturn(manyComments());
        when(workItemHistoryService.getWbsActivities("tester", 1L, 10L, 100L)).thenReturn(List.of());
        final var service = new AiReadContextService(
            projectService,
            wbsService,
            null,
            null,
            null,
            workItemHistoryService,
            new AiSourceChipFactory()
        );

        final var result = service.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L),
                Set.of(AiReadContextService.ReadTool.HISTORY),
                false,
                null,
                "최근 이력 목록"
            )
        );

        assertThat(result.sanitizedProviderContext())
            .contains("returnedCount=25")
            .contains("totalCount=26")
            .contains("truncated=true")
            .doesNotContain("댓글 0");
        assertThat(result.sourceChips()).containsExactly(new AiReadContextService.SourceChip("Alpha", "history", 25));
    }

    @Test
    @DisplayName("13-01 history detail marks WBS scan truncation separately from row truncation")
    void historyDetailMarksWbsScanTruncation() {
        when(projectService.getProject("tester", 1L, 10L))
            .thenReturn(new ProjectService.ProjectResult(10L, "Alpha", "", 1L, null, null));
        when(wbsService.getWbsItems("tester", 1L, 10L)).thenReturn(manyWbsItems(26));
        for (long id = 1L; id <= AiReadContextService.MAX_WBS_DETAIL_ROWS; id++) {
            when(workItemHistoryService.getWbsComments("tester", 1L, 10L, id)).thenReturn(List.of());
            when(workItemHistoryService.getWbsActivities("tester", 1L, 10L, id)).thenReturn(List.of());
        }
        final var service = new AiReadContextService(
            projectService,
            wbsService,
            null,
            null,
            null,
            workItemHistoryService,
            new AiSourceChipFactory()
        );

        final var result = service.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L),
                Set.of(AiReadContextService.ReadTool.HISTORY),
                false,
                null,
                "최근 이력 목록"
            )
        );

        assertThat(result.sanitizedProviderContext())
            .contains("wbsScannedCount=25")
            .contains("wbsTotalCount=26")
            .contains("wbsScanTruncated=true")
            .contains("truncated=true");
    }

    @Test
    @DisplayName("13-01 member TODO aggregate caps owner rows after grouping")
    void memberTodoAggregateCapsOwnerRowsAfterGrouping() {
        when(projectTodoService.getMemberTodoSummaries("tester", 1L, 10L)).thenReturn(manyMemberTodoSummaries(21));
        final var service = new AiReadContextService(null, null, null, null, projectTodoService, null, new AiSourceChipFactory());

        final var result = service.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L),
                Set.of(AiReadContextService.ReadTool.TODO),
                true,
                null,
                "팀원 TODO 상태를 알려줘"
            )
        );

        assertThat(result.sanitizedProviderContext())
            .contains("returnedOwners=20")
            .contains("totalOwners=21")
            .contains("ownerTruncated=true")
            .doesNotContain("member-21");
        assertThat(result.sourceChips()).containsExactly(new AiReadContextService.SourceChip("Project 10", "TODO", 21));
    }

    @Test
    @DisplayName("13-01 provider context truncation keeps explicit marker and caps")
    void providerContextTruncationKeepsExplicitMarkerAndCaps() {
        when(projectService.getProject("tester", 1L, 10L))
            .thenReturn(new ProjectService.ProjectResult(10L, "Alpha", "", 1L, null, null));
        when(projectService.getProject("tester", 1L, 11L))
            .thenReturn(new ProjectService.ProjectResult(11L, "Beta", "", 1L, null, null));
        when(projectIssueService.getProjectIssues("tester", 1L, 10L, null)).thenReturn(manyIssuesWithLongDescriptions());
        when(projectIssueService.getProjectIssues("tester", 1L, 11L, null)).thenReturn(manyIssuesWithLongDescriptions());
        final var service = new AiReadContextService(
            projectService,
            null,
            null,
            projectIssueService,
            null,
            null,
            new AiSourceChipFactory()
        );

        final var result = service.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L, 11L),
                Set.of(AiReadContextService.ReadTool.ISSUES),
                false,
                null,
                "이슈 상세 목록"
            )
        );

        assertThat(result.sanitizedProviderContext())
            .hasSizeLessThanOrEqualTo(AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS)
            .contains("providerContextTruncated=true")
            .contains("providerContextMaxChars")
            .contains("...[truncated]");
    }

    @Test
    @DisplayName("13-01 provider context keeps caps even when facts and sources overflow")
    void providerContextKeepsCapsWhenFactsAndSourcesOverflow() {
        final var longProjectName = "긴 프로젝트명 ".repeat(500);
        for (long projectId = 10L; projectId <= 14L; projectId++) {
            when(projectService.getProject("tester", 1L, projectId))
                .thenReturn(new ProjectService.ProjectResult(projectId, longProjectName + projectId, "", 1L, null, null));
            when(projectService.getBusinessOverview("tester", 1L, projectId))
                .thenReturn(
                    new ProjectService.BusinessOverviewResult(
                        projectId,
                        longProjectName + projectId,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        1L,
                        1L,
                        10
                    )
                );
        }
        final var service = new AiReadContextService(projectService, null, null, null, null, null, new AiSourceChipFactory());

        final var result = service.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L, 11L, 12L, 13L, 14L),
                Set.of(AiReadContextService.ReadTool.OVERVIEW),
                false,
                null,
                "프로젝트 개요"
            )
        );

        assertThat(result.sanitizedProviderContext())
            .hasSizeLessThanOrEqualTo(AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS)
            .contains("providerContextTruncated=true")
            .contains("providerContextMaxChars");
    }

    @Test
    @DisplayName("10-02 read context applies hard caps before provider serialization")
    void readContextAppliesHardCapsBeforeProviderSerialization() {
        final var manyProjects = LongStream.rangeClosed(1, 25).boxed().toList();

        final var result = readContextService.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                manyProjects,
                Set.of(
                    AiReadContextService.ReadTool.OVERVIEW,
                    AiReadContextService.ReadTool.WBS,
                    AiReadContextService.ReadTool.MILESTONES,
                    AiReadContextService.ReadTool.ISSUES,
                    AiReadContextService.ReadTool.TODO,
                    AiReadContextService.ReadTool.HISTORY
                ),
                false,
                null,
                "프로젝트별 상세 지연과 미완료 항목을 자세히 알려줘"
            )
        );

        assertThat(result.confirmedFacts()).hasSizeLessThanOrEqualTo(AiReadContextService.MAX_FACTS);
        assertThat(result.sanitizedProviderContext()).hasSizeLessThanOrEqualTo(
            AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS
        );
        assertThat(result.capMetadata())
            .containsEntry("teamProjectInputCount", 25)
            .containsEntry("teamProjectReadCount", AiReadContextService.MAX_TEAM_PROJECTS)
            .containsEntry("detailedProjectReadCount", AiReadContextService.MAX_DETAILED_PROJECTS);
    }

    @Test
    @DisplayName("10-W0-02 authorized member TODO reads stay aggregate only")
    void w0_10_W0_02_memberTodoReadExposesOnlyAggregateCounts() {
        final var result = readContextService.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L),
                Set.of(AiReadContextService.ReadTool.TODO),
                true,
                "member-1"
            )
        );

        assertThat(result.confirmedFacts()).contains("member-1 TODO summary: total=7 delayed=2 done=3");
        assertThat(result.toString())
            .doesNotContain("todoTitle")
            .doesNotContain("todoDescription")
            .doesNotContain("linkedDocument")
            .doesNotContain("targetDate");
    }

    @Test
    @DisplayName("10-02 member TODO summary uses aggregate-only service path")
    void memberTodoSummaryUsesAggregateOnlyServicePath() {
        when(projectTodoService.getMemberTodoSummaries("tester", 1L, 10L))
            .thenReturn(
                List.of(
                    new ProjectTodoService.MemberTodoSummaryResult(100L, "member-1", ProjectTodoStatus.TODO, 4L),
                    new ProjectTodoService.MemberTodoSummaryResult(100L, "member-1", ProjectTodoStatus.DONE, 3L)
                )
            );
        final var service = new AiReadContextService(null, null, null, null, projectTodoService, null, new AiSourceChipFactory());

        final var result = service.read(
            "tester",
            new AiReadContextService.ReadCommand(
                1L,
                List.of(10L),
                Set.of(AiReadContextService.ReadTool.TODO),
                true,
                "member-1",
                "팀원 TODO 상태를 알려줘"
            )
        );

        assertThat(result.confirmedFacts()).contains("member-1 TODO summary: total=7 done=3");
        assertThat(result.sanitizedProviderContext()).doesNotContain("todoDescription").doesNotContain("targetDate");
        verify(projectTodoService).getMemberTodoSummaries("tester", 1L, 10L);
    }

    @Test
    @DisplayName("10-W0-02 read context exposes sanitized summaries only")
    void w0_10_W0_02_readContextDoesNotExposeRawPromptOrProviderPayloads() {
        final var result = readContextService.read(
            "tester",
            new AiReadContextService.ReadCommand(1L, List.of(10L), Set.of(AiReadContextService.ReadTool.ISSUES), false, null)
        );

        assertThat(result.toString())
            .doesNotContain("rawPrompt")
            .doesNotContain("rawContext")
            .doesNotContain("rawProviderOutput")
            .doesNotContain("accessToken")
            .doesNotContain("refreshToken")
            .doesNotContain("cookie")
            .doesNotContain("password")
            .doesNotContain("env");
    }

    @Test
    @DisplayName("10-02 source chips use actual read result counts")
    void sourceChipsUseActualReadResultCounts() {
        final var chips = new AiSourceChipFactory()
            .fromToolResults(List.of(new AiReadContextService.ToolReadResult("A Project", "issues", 12)));

        assertThat(chips).containsExactly(new AiReadContextService.SourceChip("A Project", "issues", 12));
    }

    private static WbsService.WbsItemResult sampleWbs() {
        return sampleWbs(100L, "화면 설계");
    }

    private static WbsService.WbsItemResult sampleWbs(Long id, String name) {
        return new WbsService.WbsItemResult(
            id,
            null,
            name,
            0,
            1,
            200L,
            "홍길동",
            LocalDate.of(2026, 6, 1),
            LocalDate.of(2026, 6, 10),
            null,
            null,
            30,
            50,
            -20,
            0,
            2,
            BigDecimal.ONE,
            300L,
            "Kickoff",
            List.of(),
            List.of(101L),
            Instant.parse("2026-06-01T00:00:00Z"),
            Instant.parse("2026-06-02T00:00:00Z")
        );
    }

    private static List<WbsService.WbsItemResult> manyWbsItems(int count) {
        return LongStream.rangeClosed(1, count).mapToObj(id -> sampleWbs(id, "WBS " + id)).toList();
    }

    private static MilestoneService.MilestoneResult sampleMilestone() {
        return new MilestoneService.MilestoneResult(
            300L,
            10L,
            "Kickoff",
            LocalDate.of(2026, 6, 15),
            "착수 승인",
            MilestoneType.APPROVAL,
            200L,
            "홍길동",
            "게이트 준비 필요",
            1,
            3L,
            1L,
            33,
            0L,
            1L,
            2L,
            true,
            Instant.parse("2026-06-01T00:00:00Z"),
            Instant.parse("2026-06-02T00:00:00Z")
        );
    }

    private static ProjectIssueService.ProjectIssueResult sampleIssue() {
        return new ProjectIssueService.ProjectIssueResult(
            400L,
            "장애 대응",
            "운영 장애 분석",
            ProjectIssuePriority.CRITICAL,
            ProjectIssueStatus.IN_PROGRESS,
            200L,
            "tester",
            "홍길동",
            Instant.parse("2026-06-01T00:00:00Z"),
            Instant.parse("2026-06-02T00:00:00Z")
        );
    }

    private static List<ProjectIssueService.ProjectIssueResult> manyIssuesWithLongDescriptions() {
        final var longDescription = "긴 설명 ".repeat(300);
        return LongStream
            .rangeClosed(1, 60)
            .mapToObj(id ->
                new ProjectIssueService.ProjectIssueResult(
                    id,
                    "이슈 " + id,
                    longDescription + id,
                    ProjectIssuePriority.HIGH,
                    ProjectIssueStatus.REGISTERED,
                    null,
                    null,
                    null,
                    Instant.parse("2026-06-01T00:00:00Z"),
                    Instant.parse("2026-06-02T00:00:00Z")
                )
            )
            .toList();
    }

    private static ProjectTodoService.ProjectTodoResult sampleTodo() {
        return new ProjectTodoService.ProjectTodoResult(
            500L,
            "내 할 일",
            "검토 필요",
            ProjectTodoStatus.TODO,
            ProjectTodoPriority.HIGH,
            LocalDate.of(2026, 6, 12),
            20,
            100L,
            "화면 설계",
            Instant.parse("2026-06-01T00:00:00Z"),
            Instant.parse("2026-06-02T00:00:00Z")
        );
    }

    private static WorkItemHistoryService.WorkCommentResult sampleComment() {
        return new WorkItemHistoryService.WorkCommentResult(
            600L,
            WorkTargetType.WBS,
            100L,
            "댓글 내용",
            "tester",
            "홍길동",
            Instant.parse("2026-06-03T00:00:00Z"),
            Instant.parse("2026-06-03T00:00:00Z")
        );
    }

    private static List<WorkItemHistoryService.WorkCommentResult> manyComments() {
        return LongStream
            .rangeClosed(0, 25)
            .mapToObj(index ->
                new WorkItemHistoryService.WorkCommentResult(
                    600L + index,
                    WorkTargetType.WBS,
                    100L,
                    "댓글 " + index,
                    "tester",
                    "홍길동",
                    Instant.parse("2026-06-03T00:00:00Z").plusSeconds(index),
                    Instant.parse("2026-06-03T00:00:00Z").plusSeconds(index)
                )
            )
            .toList();
    }

    private static List<ProjectTodoService.MemberTodoSummaryResult> manyMemberTodoSummaries(int ownerCount) {
        return LongStream
            .rangeClosed(1, ownerCount)
            .mapToObj(index ->
                new ProjectTodoService.MemberTodoSummaryResult(
                    900L + index,
                    "member-" + index,
                    ProjectTodoStatus.TODO,
                    1L
                )
            )
            .toList();
    }

    private static WorkItemHistoryService.WorkActivityResult sampleActivity() {
        return new WorkItemHistoryService.WorkActivityResult(
            700L,
            WorkTargetType.WBS,
            100L,
            WorkActivityEventType.DOCUMENT_LINKED,
            WorkActivitySubjectType.DOCUMENT,
            800L,
            "요구사항정의서",
            null,
            null,
            "Linked document to WBS item",
            "tester",
            "홍길동",
            Instant.parse("2026-06-04T00:00:00Z")
        );
    }
}
