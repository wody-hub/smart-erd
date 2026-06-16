package com.smarterd.application.ai.history;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.ai.AiActionProposalRepository;
import com.smarterd.domain.ai.AiExecutionAudit;
import com.smarterd.domain.ai.AiExecutionAuditRepository;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AiProjectHistoryServiceTest {

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private AiActionProposalRepository proposalRepository;

    @Mock
    private AiExecutionAuditRepository auditRepository;

    private AiProjectHistoryService service;

    @BeforeEach
    void setUp() {
        service = new AiProjectHistoryService(
            projectContextLoader,
            proposalRepository,
            auditRepository,
            new ObjectMapper().findAndRegisterModules()
        );
    }

    @Test
    void getProjectHistory_checksAuthorizationBeforeRepositoryQueries() {
        when(projectContextLoader.load("viewer", 1L, 10L, false)).thenThrow(new DomainAccessDeniedException("denied"));

        assertThatThrownBy(() -> service.getProjectHistory("viewer", 1L, 10L, 50)).isInstanceOf(
            DomainAccessDeniedException.class
        );
        verifyNoInteractions(proposalRepository, auditRepository);
    }

    @Test
    void getProjectHistory_capsLimitAtOneHundred() {
        authorize();
        when(
            proposalRepository.findByTeamIdAndProjectId(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(List.of());
        when(
            auditRepository.findByTeamIdAndProjectId(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(List.of());

        final var result = service.getProjectHistory("viewer", 1L, 10L, 500);

        final var pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(proposalRepository).findByTeamIdAndProjectId(
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(10L),
            pageableCaptor.capture()
        );
        assertThat(result.limit()).isEqualTo(100);
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(101);
    }

    @Test
    void getProjectHistory_hidesPersonalTodoDetailFromOtherMember() {
        authorize();
        when(
            proposalRepository.findByTeamIdAndProjectId(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(List.of(proposal("owner", "todo.update", "todo", "TODO-1", "Private TODO", "Private content")));
        when(
            auditRepository.findByTeamIdAndProjectId(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(List.of());

        final var result = service.getProjectHistory("viewer", 1L, 10L, 50);

        assertThat(result.items()).hasSize(1);
        assertThat(result.items().getFirst().summary()).isEqualTo("Personal TODO detail hidden");
        assertThat(result.items().getFirst().targetId()).isNull();
        assertThat(result.items().getFirst().targetLabel()).isNull();
    }

    @Test
    void getProjectHistory_keepsWbsLinkedTodoSummaryVisible() {
        authorize();
        when(
            proposalRepository.findByTeamIdAndProjectId(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(
            List.of(proposal("owner", "todo.update", "todo", "wbs:22", "[wbs] Shared TODO", "Shared content"))
        );
        when(
            auditRepository.findByTeamIdAndProjectId(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(List.of());

        final var result = service.getProjectHistory("viewer", 1L, 10L, 50);

        assertThat(result.items().getFirst().summary()).isEqualTo("Shared content");
        assertThat(result.items().getFirst().targetLabel()).isEqualTo("[wbs] Shared TODO");
    }

    @Test
    void getProjectHistory_returnsProposalAndAuditMetadataWithoutRawFields() {
        authorize();
        when(
            proposalRepository.findByTeamIdAndProjectId(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(List.of(proposal("viewer", "issue.create", "issue", "ISS-1", "Risk issue", "Create issue")));
        when(
            auditRepository.findByTeamIdAndProjectId(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(List.of(audit()));

        final var result = service.getProjectHistory("viewer", 1L, 10L, 50);

        assertThat(result.items()).hasSize(2);
        assertThat(result.items()).extracting(AiProjectHistoryItemView::proposalId).contains("proposal-1");
        assertThat(result.toString())
            .doesNotContain("sanitizedPayloadJson")
            .doesNotContain("rawPrompt")
            .doesNotContain("rawContext")
            .doesNotContain("providerOutput")
            .doesNotContain("stdout")
            .doesNotContain("stderr")
            .doesNotContain("cookie")
            .doesNotContain("credential");
    }

    private void authorize() {
        when(projectContextLoader.load("viewer", 1L, 10L, false)).thenReturn(
            new ProjectContextLoader.ProjectContext(null, null)
        );
    }

    private AiActionProposal proposal(
        String requestedBy,
        String actionType,
        String targetType,
        String targetId,
        String targetLabel,
        String summary
    ) {
        return new AiActionProposal(
            "proposal-1",
            "exec-1",
            "noop",
            "provider-response-v1",
            actionType,
            AiActionRiskLevel.LOW,
            1L,
            10L,
            targetType,
            targetId,
            targetLabel,
            "Create issue",
            summary,
            requestedBy,
            Instant.EPOCH.plusSeconds(900),
            "{\"rawPrompt\":\"hidden\"}",
            "{}"
        );
    }

    private AiExecutionAudit audit() {
        return new AiExecutionAudit(
            "exec-1",
            "noop",
            "provider-response-v1",
            "PROPOSAL_REJECTED",
            null,
            "UNSUPPORTED_ACTION",
            null,
            "viewer",
            1L,
            10L,
            "Unsupported action",
            "No executor is registered for this action type.",
            "proposal-1",
            "issue.create",
            "LOW",
            "issue",
            "ISS-1",
            "Risk issue",
            "viewer",
            Instant.EPOCH
        );
    }
}
