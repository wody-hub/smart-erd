package com.smarterd.application.ai.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import com.smarterd.domain.project.service.ProjectService;
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
            .contains("history:10")
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
}
