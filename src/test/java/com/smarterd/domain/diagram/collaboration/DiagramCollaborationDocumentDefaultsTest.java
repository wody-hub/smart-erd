package com.smarterd.domain.diagram.collaboration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DiagramCollaborationDocumentDefaultsTest {

    @Test
    void screenSpec_shouldPublishCurrentSchemaVersion() {
        final var defaults = DiagramCollaborationDocumentDefaults.resolve("screen-spec");

        assertThat(defaults.pluginId()).isEqualTo("screen-spec");
        assertThat(defaults.pluginSchemaVersion()).isEqualTo(ScreenSpecCollaborationPlugin.SCHEMA_VERSION);
    }

    @Test
    void screendesignAlias_shouldResolveCanonicalScreenSpecDefaults() {
        final var defaults = DiagramCollaborationDocumentDefaults.resolve("screendesign");

        assertThat(defaults.pluginId()).isEqualTo("screen-spec");
        assertThat(defaults.pluginSchemaVersion()).isEqualTo(ScreenSpecCollaborationPlugin.SCHEMA_VERSION);
    }

    @Test
    void markdownAndErd_shouldKeepLegacySchemaVersion() {
        final var markdownDefaults = DiagramCollaborationDocumentDefaults.resolve("markdown");
        final var erdDefaults = DiagramCollaborationDocumentDefaults.resolve("erd");

        assertThat(markdownDefaults.pluginSchemaVersion()).isEqualTo(MarkdownCollaborationPlugin.SCHEMA_VERSION);
        assertThat(erdDefaults.pluginSchemaVersion()).isEqualTo(
            DiagramCollaborationDocumentDefaults.DEFAULT_PLUGIN_SCHEMA_VERSION
        );
    }
}
