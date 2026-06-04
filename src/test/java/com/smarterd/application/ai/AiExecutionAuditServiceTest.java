package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposal;
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

    @Test
    void recordCapsErrorMetadata() {
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
            AiProviderResult.failed(new AiProviderError("FAILED", "T".repeat(250), "D".repeat(700), false)),
            25L
        );

        service.record(execution);

        final var captor = ArgumentCaptor.forClass(AiExecutionAudit.class);
        verify(auditRepository).save(captor.capture());
        assertThat(captor.getValue().getRedactedErrorTitle()).hasSize(200);
        assertThat(captor.getValue().getRedactedErrorDetail()).hasSize(500);
    }

    @Test
    void recordProposalDecisionPersistsRedactedMetadataOnly() {
        final var service = new AiExecutionAuditService(auditRepository);
        final var proposal = proposal();
        proposal.cancel("approver", Instant.EPOCH.plusSeconds(60));

        service.recordProposalDecision(proposal);

        final var captor = ArgumentCaptor.forClass(AiExecutionAudit.class);
        verify(auditRepository).save(captor.capture());
        final var audit = captor.getValue();
        assertThat(audit.getStatus()).isEqualTo("PROPOSAL_CANCELLED");
        assertThat(audit.getExecutionId()).isEqualTo("exec-1");
        assertThat(audit.getProposalId()).isEqualTo("proposal-1");
        assertThat(audit.getActionType()).isEqualTo("issue.create");
        assertThat(audit.getRiskLevel()).isEqualTo("LOW");
        assertThat(audit.getTargetType()).isEqualTo("issue");
        assertThat(audit.getDecisionBy()).isEqualTo("approver");
        assertThat(audit.getRedactedErrorDetail()).isNull();
    }

    private AiActionProposal proposal() {
        return new AiActionProposal(
            "proposal-1",
            "exec-1",
            "noop",
            "provider-response-v1",
            "issue.create",
            AiActionRiskLevel.LOW,
            1L,
            10L,
            "issue",
            "ISS-1",
            "Risk issue",
            "Create issue",
            "Create a proposal",
            "tester",
            Instant.EPOCH.plusSeconds(900),
            "{\"targetType\":\"issue\",\"targetId\":\"ISS-1\"}",
            "{}"
        );
    }
}
