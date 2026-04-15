package com.smarterd.domain.markdown.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

class MarkdownTemplateServiceTest {

    private final MarkdownTemplateService markdownTemplateService = new MarkdownTemplateService();
    private final Yaml yaml = new Yaml();

    @Test
    void buildInitialContent_preservesColonInTitleAsString() {
        final var content = markdownTemplateService.buildInitialContent("API: Auth", "technical-spec");

        assertThat(parseFrontmatter(content).get("title")).isEqualTo("API: Auth");
    }

    @Test
    void buildInitialContent_preservesBracketedTitleAsString() {
        final var content = markdownTemplateService.buildInitialContent("[Draft]", "technical-spec");

        assertThat(parseFrontmatter(content).get("title")).isEqualTo("[Draft]");
    }

    private Map<String, Object> parseFrontmatter(String content) {
        final int startMarkerLength = "---\n".length();
        final int endIndex = content.indexOf("\n---\n", startMarkerLength);
        final var frontmatterBody = content.substring(startMarkerLength, endIndex);
        @SuppressWarnings("unchecked")
        final var loaded = (Map<String, Object>) yaml.load(frontmatterBody);
        return loaded;
    }
}
