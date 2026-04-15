package com.smarterd.application.diagram.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.SaveDiagramResult;
import com.smarterd.domain.project.entity.Project;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SaveDiagramUseCaseTest {

    @Mock
    private DiagramService diagramService;

    @Mock
    private SaveDiagramAuthoritativeContentUseCase saveDiagramAuthoritativeContentUseCase;

    @Test
    void execute_loadsWritableDiagramAndReturnsMappedResult() {
        final var useCase = new SaveDiagramUseCase(diagramService, saveDiagramAuthoritativeContentUseCase);
        final var diagram = Diagram.builder()
            .name("D")
            .project(Project.builder().name("P").build())
            .content("{\"nodes\":[]}")
            .build();
        final var result = new SaveDiagramResult(2L, true, 2L, null, null);
        final var snapshot = new byte[] { 1, 2 };

        when(diagramService.loadWritableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);
        when(diagramService.buildSaveDiagramResult(diagram)).thenReturn(result);

        final var saved = useCase.execute("tester", 1L, 10L, 100L, "{\"nodes\":[{\"id\":\"n1\"}]}", snapshot);

        assertThat(saved).isSameAs(result);
        verify(saveDiagramAuthoritativeContentUseCase).execute(diagram, "{\"nodes\":[{\"id\":\"n1\"}]}", snapshot);
        verify(diagramService).buildSaveDiagramResult(diagram);
    }
}
