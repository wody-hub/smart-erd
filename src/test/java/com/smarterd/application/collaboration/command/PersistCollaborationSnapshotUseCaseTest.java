package com.smarterd.application.collaboration.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupport;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupportRegistry;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotSaveCommand;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PersistCollaborationSnapshotUseCaseTest {

    @Mock
    private CollaborationRuntimeSupportRegistry collaborationRuntimeSupportRegistry;

    @Mock
    private CollaborationSnapshotStore collaborationSnapshotStore;

    @Mock
    private CollaborationRuntimeSupport collaborationRuntimeSupport;

    @Test
    void persistDiagramSnapshot_delegatesToPluginSnapshotStore() {
        final var useCase = new PersistCollaborationSnapshotUseCase(collaborationRuntimeSupportRegistry);
        final var expectedKey = new CollaborationResourceKey("diagram", "42");
        final var command = new CollaborationSnapshotSaveCommand("17", new byte[] { 0x01 }, false);

        when(collaborationRuntimeSupportRegistry.getRequired(expectedKey)).thenReturn(collaborationRuntimeSupport);
        when(collaborationRuntimeSupport.snapshotStore()).thenReturn(collaborationSnapshotStore);
        when(collaborationSnapshotStore.save(expectedKey, command)).thenReturn(true);

        assertThat(useCase.persistSnapshot(expectedKey, command)).isTrue();

        verify(collaborationSnapshotStore).save(expectedKey, command);
    }
}
