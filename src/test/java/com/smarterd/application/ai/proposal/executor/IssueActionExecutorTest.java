package com.smarterd.application.ai.proposal.executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IssueActionExecutorTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Mock
    private ProjectIssueService projectIssueService;

    private IssueCreateActionExecutor createExecutor;
    private IssueUpdateActionExecutor updateExecutor;

    @BeforeEach
    void setUp() {
        final var payloadReader = new AiActionPayloadReader(objectMapper);
        final var resultWriter = new AiActionExecutionResultWriter(objectMapper);
        createExecutor = new IssueCreateActionExecutor(payloadReader, resultWriter, projectIssueService);
        updateExecutor = new IssueUpdateActionExecutor(payloadReader, resultWriter, projectIssueService);
    }

    @Test
    void issueCreate_callsProjectIssueServiceWithAllowlistedFields() throws Exception {
        when(projectIssueService.createProjectIssue(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.any()))
            .thenReturn(issue(33L, "Follow-up", "Body", ProjectIssuePriority.HIGH, null));

        final var result = createExecutor.execute(
            "tester",
            proposal(
                IssueCreateActionExecutor.ACTION_TYPE,
                "issue",
                null,
                Map.of(
                    "targetType",
                    "issue",
                    "fields",
                    List.of(
                        Map.of("name", "title", "afterValue", "Follow-up"),
                        Map.of("name", "description", "afterValue", "Body"),
                        Map.of("name", "priority", "afterValue", "HIGH")
                    )
                )
            )
        );

        final var command = ArgumentCaptor.forClass(ProjectIssueService.CreateProjectIssueCommand.class);
        verify(projectIssueService).createProjectIssue(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.eq(10L), command.capture());
        assertThat(command.getValue().title()).isEqualTo("Follow-up");
        assertThat(command.getValue().priority()).isEqualTo(ProjectIssuePriority.HIGH);
        assertThat(result.resultJson()).contains("\"resourceId\":\"33\"").contains("Issue created.");
    }

    @Test
    void issueUpdate_mergesCurrentStateAndRejectsStaleBeforeValue() throws Exception {
        when(projectIssueService.getProjectIssue("tester", 1L, 10L, 44L))
            .thenReturn(issue(44L, "Current", "Body", ProjectIssuePriority.MEDIUM, 7L));

        final var proposal = proposal(
            IssueUpdateActionExecutor.ACTION_TYPE,
            "issue",
            "44",
            Map.of(
                "targetType",
                "issue",
                "targetId",
                "44",
                "fields",
                List.of(Map.of("name", "title", "beforeValue", "Old", "afterValue", "New"))
            )
        );

        assertThatThrownBy(() -> updateExecutor.execute("tester", proposal)).isInstanceOf(IllegalArgumentException.class);
        verify(projectIssueService, never())
            .updateProjectIssue(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void issueCreate_rejectsUnknownFieldsWithoutMutation() throws Exception {
        final var proposal = proposal(
            IssueCreateActionExecutor.ACTION_TYPE,
            "issue",
            null,
            Map.of("targetType", "issue", "fields", List.of(Map.of("name", "status", "afterValue", "DONE")))
        );

        assertThatThrownBy(() -> createExecutor.execute("tester", proposal)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(projectIssueService);
    }

    private ProjectIssueService.ProjectIssueResult issue(
        Long id,
        String title,
        String description,
        ProjectIssuePriority priority,
        Long assigneeUserId
    ) {
        return new ProjectIssueService.ProjectIssueResult(
            id,
            title,
            description,
            priority,
            ProjectIssueStatus.REGISTERED,
            assigneeUserId,
            null,
            null,
            Instant.EPOCH,
            Instant.EPOCH
        );
    }

    private AiActionProposal proposal(String actionType, String targetType, String targetId, Map<String, Object> payload)
        throws Exception {
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
            "Target",
            "Title",
            "Summary",
            "tester",
            Instant.now().plusSeconds(900),
            objectMapper.writeValueAsString(payload),
            "{}"
        );
    }
}
