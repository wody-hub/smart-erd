package com.smarterd.domain.diagram.collaboration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationResourceKeyFactory;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.collaboration.handoff.CollaborationHandoffResult;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotSaveCommand;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DiagramCollaborationPluginTest {

    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory =
        new DiagramCollaborationResourceKeyFactory();

    @Mock
    private DiagramSnapshotService diagramSnapshotService;

    @Mock
    private DiagramRoomManager diagramRoomManager;

    @Mock
    private CollaborationSnapshotStore collaborationSnapshotStore;

    @Mock
    private DiagramCollaborationTicketIssuer collaborationTicketIssuer;

    @Mock
    private DiagramCollaborationTicketAuthenticator collaborationTicketAuthenticator;

    @Test
    void accessPolicy_shouldAcceptDiagramChannelSession() {
        final var policy = new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory);
        final var session = new CollaborationAuthenticatedSession(
            "user-1",
            "login-1",
            "Tester",
            new CollaborationResourceKey("diagram", "42"),
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        policy.validateAccess(session);
    }

    @Test
    void accessPolicy_shouldRejectNonDiagramChannelSession() {
        final var policy = new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory);
        final var session = new CollaborationAuthenticatedSession(
            "user-1",
            "login-1",
            "Tester",
            new CollaborationResourceKey("board", "42"),
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        assertThatThrownBy(() -> policy.validateAccess(session))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("board");
    }

    @Test
    void snapshotStore_shouldDelegateLoadAndSaveToDiagramSnapshotService() {
        final var store = new DiagramCollaborationSnapshotStore(diagramSnapshotService, resourceKeyFactory);
        final var resourceKey = resourceKeyFactory.forDiagramId(42L);
        final var command = new CollaborationSnapshotSaveCommand("17", new byte[] { 0x01, 0x02 });
        final var snapshot = new byte[] { 0x11, 0x22 };

        when(diagramSnapshotService.loadSnapshot(42L)).thenReturn(snapshot);
        when(diagramSnapshotService.replaceSnapshotWithClientState(42L, "17", command.fullStateUpdate()))
            .thenReturn(true);

        assertThat(store.load(resourceKey)).isEqualTo(snapshot);
        final var saved = store.save(resourceKey, command);

        assertThat(saved).isTrue();
        verify(diagramSnapshotService).loadSnapshot(42L);
        verify(diagramSnapshotService).replaceSnapshotWithClientState(42L, "17", command.fullStateUpdate());
    }

    @Test
    void handoffPolicy_shouldPreferWarmSnapshotWhenPendingUpdatesExist() {
        final var policy = new DiagramCollaborationHandoffPolicy(
            diagramRoomManager,
            diagramSnapshotService,
            resourceKeyFactory
        );
        final var resourceKey = resourceKeyFactory.forDiagramId(42L);
        final var pendingUpdates = new byte[] { 0x55 };
        final var warmSnapshot = new byte[] { 0x11, 0x22 };

        when(diagramRoomManager.getSessionCount(42L)).thenReturn(2);
        when(diagramRoomManager.peekMergedUpdates(42L)).thenReturn(pendingUpdates);
        when(diagramSnapshotService.buildWarmHandoffSnapshot(42L, pendingUpdates)).thenReturn(warmSnapshot);

        final var result = policy.buildHandoffSnapshot(resourceKey, collaborationSnapshotStore);

        assertThat(result).isEqualTo(new CollaborationHandoffResult(warmSnapshot, "warm"));

        verify(diagramRoomManager).getSessionCount(42L);
        verify(diagramRoomManager).peekMergedUpdates(42L);
        verify(diagramSnapshotService).buildWarmHandoffSnapshot(42L, pendingUpdates);
        verify(collaborationSnapshotStore, never()).load(resourceKey);
    }

    @Test
    void handoffPolicy_shouldFallbackToPersistedSnapshotStoreWhenRoomHasNoPendingUpdates() {
        final var policy = new DiagramCollaborationHandoffPolicy(
            diagramRoomManager,
            diagramSnapshotService,
            resourceKeyFactory
        );
        final var resourceKey = resourceKeyFactory.forDiagramId(42L);
        final var cachedSnapshot = new byte[] { 0x10, 0x20 };
        when(diagramRoomManager.getSessionCount(42L)).thenReturn(1);
        when(diagramSnapshotService.getCachedSnapshot(42L)).thenReturn(java.util.Optional.of(cachedSnapshot));

        final var result = policy.buildHandoffSnapshot(resourceKey, collaborationSnapshotStore);

        assertThat(result).isEqualTo(new CollaborationHandoffResult(cachedSnapshot, "cached"));

        verify(collaborationSnapshotStore, never()).load(resourceKey);
    }

    @Test
    void handoffPolicy_shouldFallbackToDbSnapshotWhenCacheIsEmpty() {
        final var policy = new DiagramCollaborationHandoffPolicy(
            diagramRoomManager,
            diagramSnapshotService,
            resourceKeyFactory
        );
        final var resourceKey = resourceKeyFactory.forDiagramId(42L);
        final var snapshot = new byte[] { 0x33, 0x44 };

        when(diagramRoomManager.getSessionCount(42L)).thenReturn(1);
        when(diagramSnapshotService.getCachedSnapshot(42L)).thenReturn(java.util.Optional.empty());
        when(collaborationSnapshotStore.load(resourceKey)).thenReturn(snapshot);

        final var result = policy.buildHandoffSnapshot(resourceKey, collaborationSnapshotStore);

        assertThat(result).isEqualTo(new CollaborationHandoffResult(snapshot, "db"));

        verify(diagramRoomManager).getSessionCount(42L);
        verify(collaborationSnapshotStore).load(resourceKey);
        verify(diagramRoomManager, never()).peekMergedUpdates(42L);
        verify(diagramSnapshotService, never()).buildWarmHandoffSnapshot(anyLong(), any());
    }

    @Test
    void channelPlugin_shouldExposeMatchingResourceKeyFactory() {
        final var plugin = new DiagramCollaborationChannelPlugin(resourceKeyFactory);

        final CollaborationResourceKeyFactory pluginResourceKeyFactory = plugin.resourceKeyFactory();

        assertThat(plugin.channelType()).isEqualTo(pluginResourceKeyFactory.channelType());
        assertThat(pluginResourceKeyFactory.create("42")).isEqualTo(resourceKeyFactory.forDiagramId(42L));
    }

    @Test
    void runtimeSupport_shouldExposeAccessSnapshotAndHandoffPolicies() {
        final var accessPolicy = new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory);
        final var snapshotStore = new DiagramCollaborationSnapshotStore(diagramSnapshotService, resourceKeyFactory);
        final var handoffPolicy = new DiagramCollaborationHandoffPolicy(
            diagramRoomManager,
            diagramSnapshotService,
            resourceKeyFactory
        );
        final var support = new DiagramCollaborationRuntimeSupport(
            accessPolicy,
            snapshotStore,
            handoffPolicy
        );

        assertThat(support.channelType()).isEqualTo(resourceKeyFactory.channelType());
        assertThat(support.accessPolicy()).isSameAs(accessPolicy);
        assertThat(support.snapshotStore()).isSameAs(snapshotStore);
        assertThat(support.handoffPolicy()).isSameAs(handoffPolicy);
    }

    @Test
    void ticketSupport_shouldExposeTicketPolicies() {
        final var support = new DiagramCollaborationTicketSupport(
            collaborationTicketIssuer,
            collaborationTicketAuthenticator
        );

        assertThat(support.channelType()).isEqualTo(resourceKeyFactory.channelType());
        assertThat(support.ticketIssuer()).isSameAs(collaborationTicketIssuer);
        assertThat(support.ticketAuthenticator()).isSameAs(collaborationTicketAuthenticator);
    }
}
