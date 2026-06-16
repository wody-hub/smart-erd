package com.smarterd.domain.markdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MarkdownExportServiceTest {

    @Test
    void markdownExportResult_defensivelyCopiesBodyBytes() {
        // given
        final var source = new byte[] { 1, 2, 3 };
        final var result = new MarkdownExportService.MarkdownExportResult("text/markdown", "doc.md", source);

        // when
        source[0] = 9;
        final var exposed = result.body();
        exposed[1] = 8;

        // then
        assertThat(result.body()).containsExactly(1, 2, 3);
    }

    @Test
    void markdownExportResult_usesBodyContentForEquality() {
        // given
        final var left = new MarkdownExportService.MarkdownExportResult(
            "text/markdown",
            "doc.md",
            new byte[] { 1, 2, 3 }
        );
        final var right = new MarkdownExportService.MarkdownExportResult(
            "text/markdown",
            "doc.md",
            new byte[] { 1, 2, 3 }
        );

        // then
        assertThat(left).isEqualTo(right);
        assertThat(left).hasSameHashCodeAs(right);
    }
}
