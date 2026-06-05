package com.smarterd.application.ai.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.validation.ActionDraftValidator;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import jakarta.validation.Validation;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class LocalCodexProcessProviderTest {

    private CodexProcessRunner runner;
    private LocalCodexProcessProvider provider;

    @BeforeEach
    void setUp() {
        runner = Mockito.mock(CodexProcessRunner.class);
        final var validator = new ProviderOutputValidator(
            new ObjectMapper(),
            Validation.buildDefaultValidatorFactory().getValidator(),
            new ActionDraftValidator()
        );
        provider = new LocalCodexProcessProvider(
            runner,
            validator,
            () -> new AiProviderStatus("local-codex", AiProviderAvailability.AVAILABLE, null, Instant.EPOCH),
            "codex",
            Duration.ofSeconds(60),
            null
        );
    }

    @Test
    void executeValidatesRunnerStdout() {
        when(runner.run(Mockito.any()))
            .thenReturn(new CodexProcessResult(CodexProcessResult.Status.SUCCEEDED, "{\"answer\":\"ok\",\"actions\":[],\"error\":null}", null));

        final var result = provider.execute(request());

        assertThat(result.answer()).isEqualTo("ok");
        assertThat(result.error()).isNull();
    }

    @Test
    void executeMapsInvalidJsonToOutputValidationError() {
        when(runner.run(Mockito.any())).thenReturn(new CodexProcessResult(CodexProcessResult.Status.SUCCEEDED, "plain", null));

        final var result = provider.execute(request());

        assertThat(result.error()).isNotNull();
        assertThat(result.error().type()).isEqualTo("OUTPUT_VALIDATION_FAILED");
    }

    @Test
    void executeMapsTimeoutToSafeProviderError() {
        when(runner.run(Mockito.any())).thenReturn(new CodexProcessResult(CodexProcessResult.Status.TIMED_OUT, "", null));

        final var result = provider.execute(request());

        assertThat(result.error()).isNotNull();
        assertThat(result.error().type()).isEqualTo("TIMED_OUT");
        assertThat(result.error().retryable()).isTrue();
    }

    private AiProviderRequest request() {
        return new AiProviderRequest("exec-1", "provider-response-v1", "hello", "ko", Map.of("teamId", 1));
    }
}
