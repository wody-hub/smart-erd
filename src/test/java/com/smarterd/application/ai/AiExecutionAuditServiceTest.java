package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.domain.ai.AiExecutionAudit;
import com.smarterd.domain.ai.AiExecutionAuditRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiExecutionAuditServiceTest {

    @Mock
    private AiExecutionAuditRepository auditRepository;

    @Test
    void recordPersistsMetadataOnly() {
        final var service = new AiExecutionAuditService(auditRepository);
        final var execution = new AiExecutionRegistry.ExecutionSnapshot(
            "exec-1",
            "tester",
            1L,
            10L,
            "noop",
            "provider-response-v1",
            AiExecutionState.FAILED,
            Instant.EPOCH,
            Instant.EPOCH,
            Instant.EPOCH.plusMillis(25),
            AiProviderResult.failed(new AiProviderError("NOT_CONFIGURED", "Not configured", "Safe detail", false)),
            25L
        );

        service.record(execution);

        final var captor = ArgumentCaptor.forClass(AiExecutionAudit.class);
        verify(auditRepository).save(captor.capture());
        assertThat(captor.getValue().getExecutionId()).isEqualTo("exec-1");
        assertThat(captor.getValue().getProvider()).isEqualTo("noop");
        assertThat(captor.getValue().getStatus()).isEqualTo("FAILED");
        assertThat(captor.getValue().getErrorType()).isEqualTo("NOT_CONFIGURED");
        assertThat(captor.getValue().getRedactedErrorDetail()).isEqualTo("Safe detail");
    }
}
