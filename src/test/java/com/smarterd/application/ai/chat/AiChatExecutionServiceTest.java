package com.smarterd.application.ai.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.application.ai.AiExecutionGateway;
import com.smarterd.application.ai.AiExecutionState;
import com.smarterd.application.ai.AiProviderExecutionRunner;
import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.application.ai.provider.AiProviderResult;
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

    private AiChatExecutionService executionService;

    @BeforeEach
    void setUp() {
        executionService = new AiChatExecutionService(contextResolver, readContextService, providerExecutionRunner);
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
                    Map.of("teamId", 1L, "projectIds", List.of(10L))
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
    }

    @Test
    @DisplayName("10-W0-08 provider actions are rejected or omitted from read-only chat response")
    void w0_10_W0_08_providerActionsAreOmittedFromChatResponse() {
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
                                Map.of("title", "Follow-up")
                            )
                        ),
                        null
                    )
                )
            );

        final var result = executionService.execute(
            "tester",
            new AiChatExecutionService.ChatCommand(1L, 10L, "Create follow-up?", "ko", "project-route")
        );

        assertThat(result.status()).isEqualTo("ERROR");
        assertThat(result.errorState().code()).isEqualTo("READ_ONLY_PROVIDER_ACTION_REJECTED");
        assertThat(result.toString()).doesNotContain("ISSUE_CREATE").doesNotContain("Follow-up");
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
}
