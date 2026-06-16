package com.smarterd.application.ai.proposal.executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AiActionPayloadReaderTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final AiActionPayloadReader reader = new AiActionPayloadReader(objectMapper);

    @Test
    void read_parsesCanonicalFieldsAndTypedValues() throws Exception {
        final var payload = reader.read(
            proposal(
                "todo.update",
                "todo",
                "17",
                Map.of(
                    "targetType",
                    "todo",
                    "targetId",
                    "17",
                    "fields",
                    List.of(
                        Map.of("name", "title", "beforeValue", "Old", "afterValue", "New"),
                        Map.of("name", "progressRate", "afterValue", "30"),
                        Map.of("name", "targetDate", "afterValue", "2026-06-30")
                    )
                )
            )
        );

        payload.requireTargetType("todo");
        payload.requireOnlyFields(Set.of("title", "progressRate", "targetDate"));
        payload.assertBeforeMatches("title", "Old");
        assertThat(payload.requireTargetId()).isEqualTo(17L);
        assertThat(payload.requiredString("title")).isEqualTo("New");
        assertThat(payload.intValue("progressRate", 0)).isEqualTo(30);
        assertThat(payload.dateValue("targetDate", null)).isEqualTo(LocalDate.of(2026, 6, 30));
    }

    @Test
    void requireOnlyFields_rejectsUnknownFieldNames() throws Exception {
        final var payload = reader.read(
            proposal(
                "issue.create",
                "issue",
                null,
                Map.of("targetType", "issue", "fields", List.of(Map.of("name", "status", "afterValue", "DONE")))
            )
        );

        assertThatThrownBy(() -> payload.requireOnlyFields(Set.of("title")))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid AI proposal payload");
    }

    @Test
    void assertBeforeMatches_rejectsStaleCurrentValues() throws Exception {
        final var payload = reader.read(
            proposal(
                "issue.update",
                "issue",
                "21",
                Map.of(
                    "targetType",
                    "issue",
                    "targetId",
                    "21",
                    "fields",
                    List.of(Map.of("name", "title", "beforeValue", "Old", "afterValue", "New"))
                )
            )
        );

        assertThatThrownBy(() -> payload.assertBeforeMatches("title", "Changed"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Current data changed");
    }

    private AiActionProposal proposal(
        String actionType,
        String targetType,
        String targetId,
        Map<String, Object> payload
    ) throws Exception {
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
