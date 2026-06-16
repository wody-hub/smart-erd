package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.provider.AiProviderAvailability;
import com.smarterd.application.ai.provider.AiProviderRequest;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.application.ai.provider.AiProviderStatus;
import com.smarterd.application.ai.validation.ActionDraftValidator;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import jakarta.validation.Validation;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiProviderExecutionRunnerTest {

    @Mock
    private AiExecutionAuditService auditService;

    @Mock
    private AiProvider aiProvider;

    private AiProviderExecutionRunner runner;

    @BeforeEach
    void setUp() {
        final var validator = new ProviderOutputValidator(
            new ObjectMapper(),
            Validation.buildDefaultValidatorFactory().getValidator(),
            new ActionDraftValidator()
        );
        final var registry = new AiExecutionRegistry(
            Duration.ofMinutes(15),
            Clock.fixed(Instant.EPOCH, ZoneOffset.UTC)
        );
        runner = new AiProviderExecutionRunner(auditService, aiProvider, registry, validator);
    }

    @Test
    void executeCreatesLifecycleRecordValidatesProviderOutputAndAudits() {
        when(aiProvider.status()).thenReturn(
            new AiProviderStatus("noop", AiProviderAvailability.AVAILABLE, null, Instant.EPOCH)
        );
        when(aiProvider.execute(org.mockito.ArgumentMatchers.any())).thenReturn(
            AiProviderResult.answer("validated answer")
        );

        final var result = runner.execute(
            "tester",
            new AiProviderExecutionRunner.RunCommand(
                1L,
                10L,
                "Summarize risks",
                "ko",
                AiExecutionGateway.PROMPT_VERSION,
                Map.of("readContext", "facts only")
            )
        );

        final var providerRequestCaptor = ArgumentCaptor.forClass(AiProviderRequest.class);
        assertThat(result.executionId()).isNotBlank();
        assertThat(result.state()).isEqualTo(AiExecutionState.SUCCEEDED);
        assertThat(result.answer()).isEqualTo("validated answer");
        verify(aiProvider).execute(providerRequestCaptor.capture());
        assertThat(providerRequestCaptor.getValue().context()).containsEntry("readContext", "facts only");
        assertThat(providerRequestCaptor.getValue().promptVersion()).isEqualTo(AiExecutionGateway.PROMPT_VERSION);
        verify(auditService).record(org.mockito.ArgumentMatchers.any());
    }
}
