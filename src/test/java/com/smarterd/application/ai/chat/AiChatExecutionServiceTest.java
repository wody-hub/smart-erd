package com.smarterd.application.ai.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.application.ai.validation.ActionDraftValidator;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import jakarta.validation.Validation;
import java.util.List;
import java.util.Map;
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
    private AiProvider aiProvider;

    private AiChatExecutionService executionService;

    @BeforeEach
    void setUp() {
        final ProviderOutputValidator outputValidator = new ProviderOutputValidator(
            new ObjectMapper(),
            Validation.buildDefaultValidatorFactory().getValidator(),
            new ActionDraftValidator()
        );
        executionService = new AiChatExecutionService(contextResolver, readContextService, aiProvider, outputValidator);
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
        verify(aiProvider, never()).execute(org.mockito.ArgumentMatchers.any());
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
        when(aiProvider.execute(org.mockito.ArgumentMatchers.any())).thenReturn(AiProviderResult.answer("Risk is concentrated in API work."));

        final var result = executionService.execute(
            "tester",
            new AiChatExecutionService.ChatCommand(1L, 10L, "Summarize risks", "ko", "project-route")
        );

        assertThat(result.conclusion()).isEqualTo("Delayed issues: 2");
        assertThat(result.confirmedFacts()).containsExactly("Delayed issues: 2", "WBS risk count: 1");
        assertThat(result.interpretation()).isEqualTo("Risk is concentrated in API work.");
        assertThat(result.sourceChips()).extracting(AiReadContextService.SourceChip::tool).containsExactly("issues");
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
        when(aiProvider.execute(org.mockito.ArgumentMatchers.any()))
            .thenReturn(
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
            );

        final var result = executionService.execute(
            "tester",
            new AiChatExecutionService.ChatCommand(1L, 10L, "Create follow-up?", "ko", "project-route")
        );

        assertThat(result.status()).isEqualTo("ANSWER");
        assertThat(result.interpretation()).isEqualTo("Create a follow-up issue.");
        assertThat(result.toString()).doesNotContain("ISSUE_CREATE").doesNotContain("Follow-up");
    }
}
