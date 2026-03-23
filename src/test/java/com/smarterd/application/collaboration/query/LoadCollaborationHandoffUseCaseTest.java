package com.smarterd.application.collaboration.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupport;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupportRegistry;
import com.smarterd.collaboration.handoff.CollaborationHandoffResult;
import com.smarterd.collaboration.handoff.CollaborationHandoffPolicy;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LoadCollaborationHandoffUseCaseTest {

    @Mock
    private CollaborationRuntimeSupportRegistry collaborationRuntimeSupportRegistry;

    @Mock
    private CollaborationSnapshotStore collaborationSnapshotStore;

    @Mock
    private CollaborationHandoffPolicy collaborationHandoffPolicy;

    @Mock
    private CollaborationRuntimeSupport collaborationRuntimeSupport;

    @Test
    void loadDiagramHandoffSnapshot_delegatesToPluginPolicyAndStore() {
        final var useCase = new LoadCollaborationHandoffUseCase(collaborationRuntimeSupportRegistry);
        final var expected = new CollaborationHandoffResult(new byte[] { 0x01, 0x02 }, "cached");
        final var expectedKey = new CollaborationResourceKey("diagram", "42");

        when(collaborationRuntimeSupportRegistry.getRequired(expectedKey)).thenReturn(collaborationRuntimeSupport);
        when(collaborationRuntimeSupport.snapshotStore()).thenReturn(collaborationSnapshotStore);
        when(collaborationRuntimeSupport.handoffPolicy()).thenReturn(collaborationHandoffPolicy);
        when(collaborationHandoffPolicy.buildHandoffSnapshot(expectedKey, collaborationSnapshotStore))
            .thenReturn(expected);

        assertThat(useCase.loadHandoffSnapshot(expectedKey)).isEqualTo(expected);

        verify(collaborationHandoffPolicy).buildHandoffSnapshot(expectedKey, collaborationSnapshotStore);
    }
}
