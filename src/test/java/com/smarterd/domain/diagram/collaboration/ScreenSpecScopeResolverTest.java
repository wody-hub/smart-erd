package com.smarterd.domain.diagram.collaboration;

import static org.assertj.core.api.Assertions.assertThat;

import com.smarterd.collaboration.plugin.ScopeLockMode;
import com.smarterd.collaboration.plugin.ScopeRef;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ScreenSpecScopeResolverTest {

    private final ScreenSpecScopeResolver resolver = new ScreenSpecScopeResolver();

    @Test
    void masterAdd_shouldResolveMastersCollectionScope() {
        final var result = resolver.resolve(
            "master:add",
            Map.of("masterId", "master-1", "name", "Filter Panel", "categoryId", "form")
        );

        assertThat(result).containsExactly(new ScopeRef("masters", "collection", ScopeLockMode.SHARED));
    }

    @Test
    void masterUpdate_shouldResolveMasterScope() {
        final var result = resolver.resolve("master:update", Map.of("masterId", "master-1", "width", 640));

        assertThat(result)
            .containsExactly(
                new ScopeRef("master", "master-1", ScopeLockMode.EXCLUSIVE),
                new ScopeRef("instance-cascade", "collection", ScopeLockMode.EXCLUSIVE)
            );
    }

    @Test
    void masterDelete_shouldResolveMasterAndCascadeScopes() {
        final var result = resolver.resolve("master:delete", Map.of("masterId", "master-1"));

        assertThat(result)
            .containsExactly(
                new ScopeRef("master", "master-1", ScopeLockMode.EXCLUSIVE),
                new ScopeRef("instance-cascade", "collection", ScopeLockMode.EXCLUSIVE)
            );
    }

    @Test
    void screenRename_shouldResolveScreenScope() {
        final var result = resolver.resolve("screen:rename", Map.of("screenId", "screen-1", "name", "Dashboard"));

        assertThat(result).containsExactly(new ScopeRef("screen", "screen-1", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void screenUpdateFrame_shouldResolveScreenAndCascadeScopes() {
        final var result = resolver.resolve(
            "screen:update-frame",
            Map.of("screenId", "screen-1", "width", 1440, "height", 900)
        );

        assertThat(result)
            .containsExactly(
                new ScopeRef("screen", "screen-1", ScopeLockMode.EXCLUSIVE),
                new ScopeRef("instance-cascade", "collection", ScopeLockMode.EXCLUSIVE)
            );
    }

    @Test
    void instanceUpdate_shouldResolveScreenLayerAndInstanceScopes() {
        final var result = resolver.resolve(
            "instance:update",
            Map.of("instanceId", "instance-1", "screenId", "screen-1", "x", 120)
        );

        assertThat(result).containsExactly(
            new ScopeRef("screen", "screen-1", ScopeLockMode.SHARED),
            new ScopeRef("layer", "screen-1", ScopeLockMode.SHARED),
            new ScopeRef("instance", "instance-1", ScopeLockMode.EXCLUSIVE)
        );
    }

    @Test
    void instanceAdd_shouldResolveMasterScopeAlongsidePlacementScopes() {
        final var result = resolver.resolve(
            "instance:add",
            Map.of("instanceId", "instance-1", "screenId", "screen-1", "masterId", "master-1", "x", 120, "y", 32)
        );

        assertThat(result).containsExactly(
            new ScopeRef("screen", "screen-1", ScopeLockMode.SHARED),
            new ScopeRef("layer", "screen-1", ScopeLockMode.SHARED),
            new ScopeRef("instance", "instance-1", ScopeLockMode.EXCLUSIVE),
            new ScopeRef("master", "master-1", ScopeLockMode.SHARED)
        );
    }

    @Test
    void layerMove_shouldResolveLayerExclusiveScope() {
        final var result = resolver.resolve(
            "layer:move",
            Map.of("instanceId", "instance-1", "screenId", "screen-1", "direction", "front")
        );

        assertThat(result).containsExactly(
            new ScopeRef("screen", "screen-1", ScopeLockMode.SHARED),
            new ScopeRef("layer", "screen-1", ScopeLockMode.EXCLUSIVE),
            new ScopeRef("instance", "instance-1", ScopeLockMode.SHARED)
        );
    }

    @Test
    void malformedKnownCommand_shouldFallbackToDocumentRootScope() {
        final var result = resolver.resolve("screen:rename", Map.of("screenId", " "));

        assertThat(result).containsExactly(new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void malformedInstancePayload_shouldFallbackToDocumentRootScope() {
        final var result = resolver.resolve("instance:update", Map.of());

        assertThat(result).containsExactly(new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE));
    }

    @Test
    void unknownCommand_shouldReturnEmptyScopes() {
        final var result = resolver.resolve("unknown:command", Map.of());

        assertThat(result).isEmpty();
    }

    @Test
    void screenSpecCollaborationPlugin_shouldExposePluginMetadata() {
        final var plugin = new ScreenSpecCollaborationPlugin();

        assertThat(plugin.pluginId()).isEqualTo("screen-spec");
        assertThat(plugin.schemaVersion()).isEqualTo(ScreenSpecCollaborationPlugin.SCHEMA_VERSION);
        assertThat(plugin.supportedEngineIds()).containsExactly("yjs");
    }
}
