package com.smarterd.domain.diagram.collaboration;

import com.smarterd.domain.diagram.entity.DiagramPluginId;

/**
 * 다이어그램 협업 문서의 기본 plugin/engine/version 상수.
 */
public final class DiagramCollaborationDocumentDefaults {

    public static final String ENGINE_ID = "yjs";
    public static final int DEFAULT_PLUGIN_SCHEMA_VERSION = 1;
    public static final int SNAPSHOT_FORMAT_VERSION = 1;
    public static final Integer ARTIFACT_VERSION = 1;

    private DiagramCollaborationDocumentDefaults() {}

    public static CollaborationDocumentDefaults resolve(String pluginId) {
        final var resolved = DiagramPluginId.from(pluginId);
        return new CollaborationDocumentDefaults(
            resolved.value(),
            ENGINE_ID,
            resolvePluginSchemaVersion(resolved),
            SNAPSHOT_FORMAT_VERSION,
            ARTIFACT_VERSION
        );
    }

    private static int resolvePluginSchemaVersion(DiagramPluginId pluginId) {
        return switch (pluginId) {
            case SCREEN_SPEC -> ScreenSpecCollaborationPlugin.SCHEMA_VERSION;
            case MARKDOWN -> MarkdownCollaborationPlugin.SCHEMA_VERSION;
            case ERD -> DEFAULT_PLUGIN_SCHEMA_VERSION;
        };
    }

    public record CollaborationDocumentDefaults(
        String pluginId,
        String engineId,
        int pluginSchemaVersion,
        int snapshotFormatVersion,
        Integer artifactVersion
    ) {}
}
