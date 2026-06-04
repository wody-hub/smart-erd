package com.smarterd.application.ai.proposal.executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.pm.history.entity.WorkTargetType;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WbsActionExecutorTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Mock
    private WorkItemHistoryService workItemHistoryService;

    private WbsCommentAddActionExecutor commentExecutor;
    private WbsMemoAddActionExecutor memoExecutor;

    @BeforeEach
    void setUp() {
        final var payloadReader = new AiActionPayloadReader(objectMapper);
        final var resultWriter = new AiActionExecutionResultWriter(objectMapper);
        commentExecutor = new WbsCommentAddActionExecutor(payloadReader, resultWriter, workItemHistoryService);
        memoExecutor = new WbsMemoAddActionExecutor(payloadReader, resultWriter, workItemHistoryService);
    }

    @Test
    void wbsCommentAdd_callsHistoryService() throws Exception {
        when(workItemHistoryService.addWbsComment("tester", 1L, 10L, 77L, "Review this WBS"))
            .thenReturn(comment(90L, 77L, "Review this WBS"));

        final var result = commentExecutor.execute(
            "tester",
            proposal(
                WbsCommentAddActionExecutor.ACTION_TYPE,
                "wbs",
                "77",
                Map.of("targetType", "wbs", "targetId", "77", "content", "Review this WBS")
            )
        );

        verify(workItemHistoryService).addWbsComment("tester", 1L, 10L, 77L, "Review this WBS");
        assertThat(result.resultJson()).contains("\"resourceType\":\"wbs-comment\"").contains("WBS comment added.");
    }

    @Test
    void wbsMemoAdd_usesSameHistoryBoundaryWithMemoResult() throws Exception {
        when(workItemHistoryService.addWbsComment("tester", 1L, 10L, 77L, "Memo text"))
            .thenReturn(comment(91L, 77L, "Memo text"));

        final var result = memoExecutor.execute(
            "tester",
            proposal(
                WbsMemoAddActionExecutor.ACTION_TYPE,
                "wbs",
                "77",
                Map.of("targetType", "wbs", "targetId", "77", "content", "Memo text")
            )
        );

        assertThat(result.resultJson()).contains("\"resourceType\":\"wbs-memo\"").contains("WBS work memo added.");
    }

    @Test
    void wbsCommentAdd_rejectsBlankContentWithoutMutation() throws Exception {
        final var proposal = proposal(
            WbsCommentAddActionExecutor.ACTION_TYPE,
            "wbs",
            "77",
            Map.of("targetType", "wbs", "targetId", "77", "content", " ")
        );

        assertThatThrownBy(() -> commentExecutor.execute("tester", proposal)).isInstanceOf(IllegalArgumentException.class);
        verify(workItemHistoryService, never())
            .addWbsComment(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    private WorkItemHistoryService.WorkCommentResult comment(Long id, Long targetId, String content) {
        return new WorkItemHistoryService.WorkCommentResult(
            id,
            WorkTargetType.WBS,
            targetId,
            content,
            "tester",
            "Tester",
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
            "WBS target",
            "Title",
            "Summary",
            "tester",
            Instant.now().plusSeconds(900),
            objectMapper.writeValueAsString(payload),
            "{}"
        );
    }
}
