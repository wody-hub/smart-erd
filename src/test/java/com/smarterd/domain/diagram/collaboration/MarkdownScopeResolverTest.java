package com.smarterd.domain.diagram.collaboration;

import static org.assertj.core.api.Assertions.assertThat;

import com.smarterd.collaboration.plugin.ScopeLockMode;
import com.smarterd.collaboration.plugin.ScopeRef;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * MarkdownScopeResolver 단위 테스트.
 *
 * <p>markdown command key별 scope 해석 규칙을 검증한다.</p>
 */
class MarkdownScopeResolverTest {

    private final MarkdownScopeResolver resolver = new MarkdownScopeResolver();

    @Test
    void sectionUpdate_shouldResolveSectionScope() {
        final var result = resolver.resolve("markdown:section-update", Map.of("sectionId", "api-\uC124\uACC4"));

        assertThat(result).containsExactly(new ScopeRef("section", "api-\uC124\uACC4", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void sectionUpdate_withEmptySectionId_shouldFallbackToRootScope() {
        final var result = resolver.resolve("markdown:section-update", Map.of("sectionId", ""));

        assertThat(result).containsExactly(new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void sectionUpdate_withNullPayload_shouldFallbackToRootScope() {
        final var result = resolver.resolve("markdown:section-update", null);

        assertThat(result).containsExactly(new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void bodyReplace_shouldResolveDocumentRootScope() {
        final var result = resolver.resolve("markdown:body-replace", Map.of());

        assertThat(result).containsExactly(new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void frontmatterUpdate_shouldResolveDocumentRootScope() {
        final var result = resolver.resolve("markdown:frontmatter-update", Map.of());

        assertThat(result).containsExactly(new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void unknownCommand_shouldFallbackToDocumentRootScope() {
        final var result = resolver.resolve("unknown:command", Map.of());

        assertThat(result).containsExactly(new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void markdownCollaborationPlugin_shouldExposeMarkdownPluginId() {
        final var plugin = new MarkdownCollaborationPlugin();

        assertThat(plugin.pluginId()).isEqualTo("markdown");
    }

    @Test
    void markdownCollaborationPlugin_shouldSupportYjsEngine() {
        final var plugin = new MarkdownCollaborationPlugin();

        assertThat(plugin.supportedEngineIds()).containsExactly("yjs");
    }
}
