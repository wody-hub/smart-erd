package com.smarterd.application.diagram.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.project.entity.Project;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class SaveDiagramAuthoritativeContentUseCaseTest {

    @Mock
    private DiagramSnapshotService diagramSnapshotService;

    @Test
    void execute_updatesContentAndSchedulesRealtimeReconcile() {
        final var useCase = new SaveDiagramAuthoritativeContentUseCase(diagramSnapshotService);
        final var diagram = Diagram.builder()
            .name("D")
            .project(Project.builder().name("P").build())
            .content("{\"nodes\":[]}")
            .build();
        ReflectionTestUtils.setField(diagram, "id", 42L);
        final var snapshot = new byte[] { 1, 2, 3 };

        useCase.execute(diagram, "{\"nodes\":[{\"id\":\"n1\"}]}", snapshot);

        assertThat(diagram.getContent()).isEqualTo("{\"nodes\":[{\"id\":\"n1\"}]}");
        assertThat(diagram.getYdocSnapshot()).isNotNull();
        assertThat(diagram.getSnapshotRevision()).isEqualTo(diagram.getContentRevision());
        verify(diagramSnapshotService).reconcileRealtimeStateWithPersistedContentAfterCommit(42L, snapshot);
    }
}
