package com.smarterd.application.collaboration.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationChannelRegistry;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotSaveCommand;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationChannelPlugin;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PersistCollaborationSnapshotUseCaseTest {

    @Mock
    private CollaborationChannelRegistry collaborationChannelRegistry;

    @Mock
    private CollaborationSnapshotStore collaborationSnapshotStore;

    @Mock
    private DiagramCollaborationChannelPlugin diagramCollaborationChannelPlugin;

    @Test
    void persistDiagramSnapshot_delegatesToPluginSnapshotStore() {
        final var useCase = new PersistCollaborationSnapshotUseCase(collaborationChannelRegistry);
        final var expectedKey = new CollaborationResourceKey("diagram", "42");
        final var command = new CollaborationSnapshotSaveCommand("17", new byte[] { 0x01 });

        when(collaborationChannelRegistry.getRequired(DiagramCollaborationChannelPlugin.CHANNEL_TYPE))
            .thenReturn(diagramCollaborationChannelPlugin);
        when(diagramCollaborationChannelPlugin.snapshotStore()).thenReturn(collaborationSnapshotStore);
        when(collaborationSnapshotStore.save(expectedKey, command)).thenReturn(true);

        assertThat(useCase.persistSnapshot(expectedKey, command)).isTrue();

        verify(collaborationSnapshotStore).save(expectedKey, command);
    }
}
