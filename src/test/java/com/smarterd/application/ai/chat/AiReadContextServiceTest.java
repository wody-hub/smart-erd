package com.smarterd.application.ai.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AiReadContextServiceTest {

    private final AiReadContextService readContextService = new AiReadContextService();

    @Test
    @DisplayName("10-W0-02 overview WBS milestone issue TODO and history summaries are source backed")
    void w0_10_W0_02_summaryFirstReadToolsReturnFactsAndSourceChips() {
        final var result = readContextService.read(
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
}
