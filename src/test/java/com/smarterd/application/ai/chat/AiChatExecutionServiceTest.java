package com.smarterd.application.ai.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.application.ai.AiExecutionGateway;
import com.smarterd.application.ai.AiExecutionState;
import com.smarterd.application.ai.AiProviderExecutionRunner;
import com.smarterd.application.ai.proposal.AiActionProposalService;
import com.smarterd.application.ai.proposal.AiActionProposalView;
import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.domain.ai.AiActionProposalStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiChatExecutionServiceTest {

    @Mock
    private AiChatContextResolver contextResolver;

    @Mock
    private AiReadContextService readContextService;

    @Mock
    private AiProviderExecutionRunner providerExecutionRunner;

    @Mock
    private AiActionProposalService proposalService;

    private AiChatExecutionService executionService;

    @BeforeEach
    void setUp() {
        executionService = new AiChatExecutionService(
            contextResolver,
            readContextService,
            providerExecutionRunner,
            proposalService
        );
    }

    @Test
    @DisplayName("10-W0-08 weak or ambiguous scope returns confirmation without provider execution")
    void w0_10_W0_08_scopeGapReturnsConfirmationBeforeProviderExecution() {
        when(contextResolver.resolve(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                AiChatContextResolver.ResolvedContext.needsConfirmation(
                    "scope-required",
                    "Select a project before asking project-data questions."
                )
            );

        final var result = executionService.execute(
            "tester",
            new AiChatExecutionService.ChatCommand(1L, null, "What is delayed?", "ko", "teams")
        );

        assertThat(result.status()).isEqualTo("NEEDS_CONFIRMATION");
        assertThat(result.needsConfirmation()).isNotEmpty();
        verify(providerExecutionRunner, never())
            .execute(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("10-W0-08 empty read context returns confirmation without provider execution")
    void w0_10_W0_08_emptyReadContextReturnsConfirmationBeforeProviderExecution() {
        when(contextResolver.resolve(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(AiChatContextResolver.ResolvedContext.resolved(1L, List.of(10L), "Alpha Project"));
        when(readContextService.read(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(new AiReadContextService.ReadContext(List.of(), List.of(), List.of(), Map.of()));

        final var result = executionService.execute(
            "tester",
            new AiChatExecutionService.ChatCommand(1L, 10L, "What is delayed?", "ko", "project-route")
        );

        assertThat(result.status()).isEqualTo("NEEDS_CONFIRMATION");
        assertThat(result.needsConfirmation()).isNotEmpty();
        verify(providerExecutionRunner, never())
            .execute(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("10-W0-08 assembler maps server facts source chips context and provider answer sections")
    void w0_10_W0_08_assemblerBuildsSectionedReadOnlyAnswer() {
        when(contextResolver.resolve(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                new AiChatContextResolver.ResolvedContext(
                    AiChatContextResolver.ScopeStatus.RESOLVED,
                    1L,
                    List.of(10L),
                    "Alpha Project",
                    List.of(),
                    List.of()
                )
            );
        when(readContextService.read(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                new AiReadContextService.ReadContext(
                    List.of("Delayed issues: 2", "WBS risk count: 1"),
                    List.of(new AiReadContextService.SourceChip("Alpha Project", "issues", 12)),
                    List.of(),
                    Map.of("teamId", 1L, "projectIds", List.of(10L)),
                    """
                    facts:
                    - Delayed issues: 2
                    summaries:
                    - overview:10: {memberCount=5}
                    - wbs:10: {count=1}
                    - milestones:10: {count=2}
                    - issues:10: {count=12}
                    - todo:10: {count=3}
                    - history:10: {count=4}
                    """,
                    java.util.Set.of(
                        AiReadContextService.ReadTool.OVERVIEW,
                        AiReadContextService.ReadTool.WBS,
                        AiReadContextService.ReadTool.MILESTONES,
                        AiReadContextService.ReadTool.ISSUES,
                        AiReadContextService.ReadTool.TODO,
                        AiReadContextService.ReadTool.HISTORY
                    ),
                    Map.of("providerContextMaxChars", AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS)
                )
            );
        when(providerExecutionRunner.execute(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(executionView(AiProviderResult.answer("Risk is concentrated in API work.")));

        final var result = executionService.execute(
            "tester",
            new AiChatExecutionService.ChatCommand(1L, 10L, "Summarize risks", "ko", "project-route")
        );

        final var commandCaptor = ArgumentCaptor.forClass(AiProviderExecutionRunner.RunCommand.class);
        assertThat(result.conclusion()).isEqualTo("Delayed issues: 2");
        assertThat(result.confirmedFacts()).containsExactly("Delayed issues: 2", "WBS risk count: 1");
        assertThat(result.interpretation()).isEqualTo("Risk is concentrated in API work.");
        assertThat(result.sourceChips()).extracting(AiReadContextService.SourceChip::tool).containsExactly("issues");
        verify(providerExecutionRunner).execute(org.mockito.ArgumentMatchers.eq("tester"), commandCaptor.capture());
        assertThat(commandCaptor.getValue().providerContext()).containsKey("readContext");
        assertThat(commandCaptor.getValue().providerContext()).containsEntry("teamId", 1L);
        assertThat(commandCaptor.getValue().providerContext().get("readContext").toString())
            .contains("overview:10")
            .contains("wbs:10")
            .contains("milestones:10")
            .contains("issues:10")
            .contains("todo:10")
            .contains("history:10");
    }

    @Test
    @DisplayName("11-W2-01 provider actions become sanitized pending proposals")
    void w2_11_W2_01_providerActionsBecomePendingProposals() {
        when(contextResolver.resolve(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                new AiChatContextResolver.ResolvedContext(
                    AiChatContextResolver.ScopeStatus.RESOLVED,
                    1L,
                    List.of(10L),
                    "Alpha Project",
                    List.of(),
                    List.of()
                )
            );
        when(readContextService.read(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                new AiReadContextService.ReadContext(
                    List.of("Issue summary loaded"),
                    List.of(new AiReadContextService.SourceChip("Alpha Project", "issues", 3)),
                    List.of(),
                    Map.of("teamId", 1L)
                )
            );
        when(providerExecutionRunner.execute(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                executionView(
                    new AiProviderResult(
                        "Create a follow-up issue.",
                        List.of(
                            new AiActionDraft(
                                "act-1",
                                "ISSUE_CREATE",
                                "Create issue",
                                "Create a project issue",
                                AiActionRiskLevel.LOW,
                                true,
                                Map.of(
                                    "targetType",
                                    "issue",
                                    "targetId",
                                    "ISS-1",
                                    "targetLabel",
                                    "Follow-up",
                                    "fields",
                                    List.of(Map.of("label", "Title", "afterValue", "Follow-up"))
                                )
                            )
                        ),
                        null
                    )
                )
            );
        when(proposalService.createProposals(org.mockito.ArgumentMatchers.any()))
            .thenReturn(List.of(proposalView("proposal-1")));

        final var result = executionService.execute(
            "tester",
            new AiChatExecutionService.ChatCommand(1L, 10L, "Create follow-up?", "ko", "project-route")
        );

        assertThat(result.status()).isEqualTo("ANSWER");
        assertThat(result.proposals()).hasSize(1);
        assertThat(result.proposals().getFirst().proposalId()).isEqualTo("proposal-1");
        assertThat(result.proposals().getFirst().title()).isEqualTo("Create issue");
        assertThat(result.errorState()).isNull();
        verify(proposalService).createProposals(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("10-W0-08 provider failure returns structured failed chat response")
    void w0_10_W0_08_providerFailureReturnsSafeStructuredResponse() {
        when(contextResolver.resolve(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(AiChatContextResolver.ResolvedContext.resolved(1L, List.of(10L), "Alpha Project"));
        when(readContextService.read(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                new AiReadContextService.ReadContext(
                    List.of("Issue summary loaded"),
                    List.of(new AiReadContextService.SourceChip("Alpha Project", "issues", 3)),
                    List.of(),
                    Map.of("teamId", 1L)
                )
            );
        when(providerExecutionRunner.execute(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                executionView(
                    AiProviderResult.failed(
                        new AiProviderError("PROVIDER_FAILED", "Provider failed", "Provider failed safely.", true)
                    )
                )
            );

        final var result = executionService.execute(
            "tester",
            new AiChatExecutionService.ChatCommand(1L, 10L, "Summarize risks", "ko", "project-route")
        );

        assertThat(result.status()).isEqualTo("ERROR");
        assertThat(result.executionId()).isEqualTo("exec-1");
        assertThat(result.errorState().code()).isEqualTo("PROVIDER_FAILED");
        assertThat(result.confirmedFacts()).containsExactly("Issue summary loaded");
    }

    private AiExecutionGateway.AiExecutionView executionView(AiProviderResult result) {
        return new AiExecutionGateway.AiExecutionView(
            "exec-1",
            "noop",
            AiExecutionGateway.PROMPT_VERSION,
            result.error() == null ? AiExecutionState.SUCCEEDED : AiExecutionState.FAILED,
            Instant.EPOCH,
            Instant.EPOCH,
            Instant.EPOCH,
            0L,
            result.answer(),
            result.actions(),
            result.error()
        );
    }

    private AiActionProposalView proposalView(String proposalId) {
        return new AiActionProposalView(
            proposalId,
            AiActionProposalStatus.PENDING,
            false,
            "ISSUE_CREATE",
            AiActionRiskLevel.LOW,
            new AiActionProposalView.Target("issue", "ISS-1", "Follow-up", 1L, 10L),
            "Create issue",
            "Create a project issue",
            List.of(new AiActionProposalView.FieldChange("Title", null, "Follow-up", "ADD")),
            "",
            List.of(),
            Instant.EPOCH.plusSeconds(900),
            null,
            null
        );
    }
}
