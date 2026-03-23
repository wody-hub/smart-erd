package com.smarterd.application.collaboration.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationChannelRegistry;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.handoff.CollaborationHandoffResult;
import com.smarterd.collaboration.handoff.CollaborationHandoffPolicy;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationChannelPlugin;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LoadCollaborationHandoffUseCaseTest {

    @Mock
    private CollaborationChannelRegistry collaborationChannelRegistry;

    @Mock
    private CollaborationSnapshotStore collaborationSnapshotStore;

    @Mock
    private CollaborationHandoffPolicy collaborationHandoffPolicy;

    @Mock
    private DiagramCollaborationChannelPlugin diagramCollaborationChannelPlugin;

    @Test
    void loadDiagramHandoffSnapshot_delegatesToPluginPolicyAndStore() {
        final var useCase = new LoadCollaborationHandoffUseCase(collaborationChannelRegistry);
        final var expected = new CollaborationHandoffResult(new byte[] { 0x01, 0x02 }, "cached");
        final var expectedKey = new CollaborationResourceKey("diagram", "42");

        when(collaborationChannelRegistry.getRequired(DiagramCollaborationChannelPlugin.CHANNEL_TYPE))
            .thenReturn(diagramCollaborationChannelPlugin);
        when(diagramCollaborationChannelPlugin.snapshotStore()).thenReturn(collaborationSnapshotStore);
        when(diagramCollaborationChannelPlugin.handoffPolicy()).thenReturn(collaborationHandoffPolicy);
        when(collaborationHandoffPolicy.buildHandoffSnapshot(expectedKey, collaborationSnapshotStore))
            .thenReturn(expected);

        assertThat(useCase.loadHandoffSnapshot(expectedKey)).isEqualTo(expected);

        verify(collaborationHandoffPolicy).buildHandoffSnapshot(expectedKey, collaborationSnapshotStore);
    }
}
