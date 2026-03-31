package com.smarterd.application.diagram.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.application.collaboration.command.PersistCollaborationSnapshotUseCase;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotSaveCommand;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.project.entity.Project;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PersistDiagramSnapshotUseCaseTest {

    @Mock
    private DiagramService diagramService;

    @Mock
    private DiagramCollaborationResourceKeyFactory diagramCollaborationResourceKeyFactory;

    @Mock
    private PersistCollaborationSnapshotUseCase persistCollaborationSnapshotUseCase;

    @Test
    void execute_validatesWritableDiagramThenDelegatesPersist() {
        final var useCase = new PersistDiagramSnapshotUseCase(
            diagramService,
            diagramCollaborationResourceKeyFactory,
            persistCollaborationSnapshotUseCase
        );
        final var diagram = Diagram.builder()
            .name("D")
            .project(Project.builder().name("P").build())
            .content("{\"nodes\":[]}")
            .build();
        final var snapshot = new byte[] { 1, 2, 3 };
        final var expectedResourceKey = new CollaborationResourceKey(
            DiagramCollaborationResourceKeyFactory.CHANNEL_TYPE,
            "100"
        );
        final var expectedCommand = new CollaborationSnapshotSaveCommand("17", snapshot, false);

        when(diagramService.loadWritableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);
        when(diagramCollaborationResourceKeyFactory.forDiagramId(100L)).thenReturn(expectedResourceKey);
        when(persistCollaborationSnapshotUseCase.persistSnapshot(expectedResourceKey, expectedCommand)).thenReturn(
            true
        );

        final var persisted = useCase.execute("tester", 1L, 10L, 100L, "17", snapshot, false);

        assertThat(persisted).isTrue();
        verify(diagramService).loadWritableDiagram("tester", 1L, 10L, 100L);
        verify(diagramCollaborationResourceKeyFactory).forDiagramId(100L);
        verify(persistCollaborationSnapshotUseCase).persistSnapshot(expectedResourceKey, expectedCommand);
    }
}
