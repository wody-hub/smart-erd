package com.smarterd.application.ai.proposal;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AiActionProposalSanitizerTest {

    private final AiActionProposalSanitizer sanitizer = new AiActionProposalSanitizer();

    @Test
    void sanitize_keepsOnlyWhitelistedRootKeys() {
        final var result = sanitizer.sanitize(
            Map.of(
                "targetType",
                "issue",
                "targetId",
                "ISS-1",
                "targetLabel",
                "Risk issue",
                "projectId",
                10L,
                "teamId",
                1L,
                "payload",
                "raw",
                "stdout",
                "secret"
            )
        );

        assertThat(result)
            .containsEntry("targetType", "issue")
            .containsEntry("targetId", "ISS-1")
            .containsEntry("targetLabel", "Risk issue")
            .containsEntry("projectId", 10L)
            .containsEntry("teamId", 1L)
            .doesNotContainKeys("payload", "stdout");
    }

    @Test
    void sanitize_removesRawKeysFromNestedMapsAndLists() {
        final var result = sanitizer.sanitize(
            Map.of(
                "fields",
                List.of(
                    Map.of(
                        "label",
                        "Status",
                        "beforeValue",
                        "Open",
                        "afterValue",
                        "In progress",
                        "rawPrompt",
                        "prompt",
                        "token",
                        "secret"
                    )
                ),
                "labels",
                Map.of("visible", "yes", "cookie", "hidden")
            )
        );

        @SuppressWarnings("unchecked")
        final var fields = (List<Map<String, Object>>) result.get("fields");
        assertThat(fields.getFirst())
            .containsEntry("label", "Status")
            .containsEntry("afterValue", "In progress")
            .doesNotContainKeys("rawPrompt", "token");

        @SuppressWarnings("unchecked")
        final var labels = (Map<String, Object>) result.get("labels");
        assertThat(labels).containsEntry("visible", "yes").doesNotContainKeys("cookie");
    }
}
