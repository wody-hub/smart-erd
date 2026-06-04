package com.smarterd.application.ai.proposal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.AiExecutionAuditService;
import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.ai.AiActionProposalRepository;
import com.smarterd.domain.ai.AiActionProposalStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiActionProposalServiceTest {

    @Mock
    private AiActionProposalRepository proposalRepository;

    @Mock
    private AiActionExecutor executor;

    @Mock
    private AiExecutionAuditService auditService;

    @Test
    void createProposals_persistsSanitizedIndependentPendingProposals() {
        final var service = service(new AiActionExecutorRegistry(List.of()));
        when(proposalRepository.save(any(AiActionProposal.class))).thenAnswer(invocation -> invocation.getArgument(0));

        final var views = service.createProposals(
            new AiActionProposalService.CreateCommand(
                "exec-1",
                "noop",
                "provider-response-v1",
                1L,
                10L,
                "tester",
                List.of(
                    draft("a1", "issue.create", "Issue one"),
                    draft("a2", "todo.update", "Todo one")
                )
            )
        );

        assertThat(views).hasSize(2);
        assertThat(views).extracting(AiActionProposalView::proposalId).doesNotHaveDuplicates();
        assertThat(views).allSatisfy(view -> {
            assertThat(view.status()).isEqualTo(AiActionProposalStatus.PENDING);
            assertThat(view.target().type()).isEqualTo("issue");
            assertThat(view.expiresAt()).isAfter(Instant.now().plusSeconds(14 * 60));
        });
        verify(auditService, times(2)).recordProposalCreated(any(AiActionProposal.class));
    }

    @Test
    void approve_rejectsUnsupportedPendingProposalWithoutExecutorInvocation() {
        final var service = service(new AiActionExecutorRegistry(List.of()));
        final var proposal = proposal("proposal-1", "issue.create");
        when(proposalRepository.findByProposalId("proposal-1")).thenReturn(Optional.of(proposal));

        final var view = service.approve("tester", "proposal-1");

        assertThat(view.status()).isEqualTo(AiActionProposalStatus.REJECTED);
        assertThat(view.redactedErrorTitle()).isEqualTo("Unsupported action");
        verify(executor, never()).execute(any(), any());
        verify(auditService).recordProposalDecision(proposal);
    }

    @Test
    void approve_rejectsPhase12ActionTypesUntilExecutorsAreRegistered() {
        final var service = service(new AiActionExecutorRegistry(List.of()));
        final var actionTypes = List.of(
            "issue.create",
            "issue.update",
            "todo.create",
            "todo.update",
            "wbs.comment.add",
            "wbs.memo.add"
        );

        for (final var actionType : actionTypes) {
            final var proposal = proposal("proposal-" + actionType, actionType);
            when(proposalRepository.findByProposalId("proposal-" + actionType)).thenReturn(Optional.of(proposal));

            final var view = service.approve("tester", "proposal-" + actionType);

            assertThat(view.status()).isEqualTo(AiActionProposalStatus.REJECTED);
            assertThat(view.redactedErrorTitle()).isEqualTo("Unsupported action");
            verify(auditService).recordProposalDecision(proposal);
        }
        verify(executor, never()).execute(any(), any());
    }

    @Test
    void approve_expiresStaleProposalBeforeExecutorLookup() {
        when(executor.actionType()).thenReturn("issue.create");
        final var service = service(new AiActionExecutorRegistry(List.of(executor)));
        final var proposal = proposal("proposal-1", "issue.create", Instant.EPOCH);
        when(proposalRepository.findByProposalId("proposal-1")).thenReturn(Optional.of(proposal));

        final var view = service.approve("tester", "proposal-1");

        assertThat(view.status()).isEqualTo(AiActionProposalStatus.EXPIRED);
        verify(executor, never()).execute(any(), any());
        verify(auditService).recordProposalDecision(proposal);
    }

    @Test
    void cancel_isIdempotentForTerminalProposal() {
        final var service = service(new AiActionExecutorRegistry(List.of()));
        final var proposal = proposal("proposal-1", "issue.create");
        proposal.cancel("tester", Instant.now());
        when(proposalRepository.findByProposalId("proposal-1")).thenReturn(Optional.of(proposal));

        final var first = service.cancel("tester", "proposal-1");
        final var second = service.cancel("tester", "proposal-1");

        assertThat(first.status()).isEqualTo(AiActionProposalStatus.CANCELLED);
        assertThat(second.status()).isEqualTo(AiActionProposalStatus.CANCELLED);
        verify(auditService, never()).recordProposalDecision(proposal);
    }

    @Test
    void cancel_recordsPendingDecisionAudit() {
        final var service = service(new AiActionExecutorRegistry(List.of()));
        final var proposal = proposal("proposal-1", "issue.create");
        when(proposalRepository.findByProposalId("proposal-1")).thenReturn(Optional.of(proposal));

        final var view = service.cancel("tester", "proposal-1");

        assertThat(view.status()).isEqualTo(AiActionProposalStatus.CANCELLED);
        verify(auditService).recordProposalDecision(proposal);
    }

    @Test
    void approve_returnsExistingTerminalStatusWithoutExecuting() {
        when(executor.actionType()).thenReturn("issue.create");
        final var service = service(new AiActionExecutorRegistry(List.of(executor)));
        final var proposal = proposal("proposal-1", "issue.create");
        proposal.reject("tester", Instant.now(), "INVALID", "Invalid", "Rejected");
        when(proposalRepository.findByProposalId("proposal-1")).thenReturn(Optional.of(proposal));

        final var view = service.approve("tester", "proposal-1");

        assertThat(view.status()).isEqualTo(AiActionProposalStatus.REJECTED);
        verify(executor, never()).execute(any(), any());
    }

    @Test
    void expirePending_marksOnlyPendingExpiredProposals() {
        final var service = service(new AiActionExecutorRegistry(List.of()));
        final var pending = proposal("proposal-1", "issue.create");
        when(proposalRepository.findByStatusAndExpiresAtBefore(AiActionProposalStatus.PENDING, Instant.EPOCH))
            .thenReturn(List.of(pending));

        final var count = service.expirePending(Instant.EPOCH);

        assertThat(count).isEqualTo(1);
        assertThat(pending.getStatus()).isEqualTo(AiActionProposalStatus.EXPIRED);
        verify(auditService).recordProposalDecision(pending);
    }

    private AiActionProposalService service(AiActionExecutorRegistry registry) {
        return new AiActionProposalService(
            proposalRepository,
            new AiActionProposalSanitizer(),
            new AiActionProposalValidator(),
            new AiActionPreviewService(),
            registry,
            auditService,
            new ObjectMapper().findAndRegisterModules()
        );
    }

    private AiActionDraft draft(String id, String actionType, String title) {
        return new AiActionDraft(
            id,
            actionType,
            title,
            "Create a proposal",
            AiActionRiskLevel.LOW,
            true,
            Map.of(
                "targetType",
                "issue",
                "targetId",
                "ISS-1",
                "targetLabel",
                "Risk issue",
                "fields",
                List.of(Map.of("label", "Title", "afterValue", title, "rawPrompt", "hidden")),
                "payload",
                "raw"
            )
        );
    }

    private AiActionProposal proposal(String proposalId, String actionType) {
        return proposal(proposalId, actionType, Instant.now().plusSeconds(900));
    }

    private AiActionProposal proposal(String proposalId, String actionType, Instant expiresAt) {
        return new AiActionProposal(
            proposalId,
            "exec-1",
            "noop",
            "provider-response-v1",
            actionType,
            AiActionRiskLevel.LOW,
            1L,
            10L,
            "issue",
            "ISS-1",
            "Risk issue",
            "Create issue",
            "Create a proposal",
            "tester",
            expiresAt,
            "{\"targetType\":\"issue\",\"targetId\":\"ISS-1\",\"targetLabel\":\"Risk issue\"}",
            "{}"
        );
    }
}
