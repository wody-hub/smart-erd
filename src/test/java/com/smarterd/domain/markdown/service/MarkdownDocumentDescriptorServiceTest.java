package com.smarterd.domain.markdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MarkdownDocumentDescriptorServiceTest {

    private final MarkdownDocumentDescriptorService service = new MarkdownDocumentDescriptorService(
        new MarkdownTemplateService()
    );

    @Test
    void describe_extractsTemplateSummaryAndNormalizedTags() {
        final var content =
            """
            ---
            title: 기능 명세
            template: technical-spec
            tags:
              - Spec
              - WBS
            ---

            # 기능 명세

            - Scope summary
            """;

        final var result = service.describe(content);

        assertThat(result.templateKey()).isEqualTo("technical-spec");
        assertThat(result.summaryText()).isEqualTo("Scope summary");
        assertThat(result.tags()).containsExactly("spec", "wbs");
    }
}
