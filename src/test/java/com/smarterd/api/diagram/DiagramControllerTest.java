package com.smarterd.api.diagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.api.diagram.dto.PersistYdocSnapshotRequest;
import com.smarterd.api.diagram.dto.SaveDiagramRequest;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.DiagramService.SaveDiagramResult;
import com.smarterd.application.diagram.command.PersistDiagramSnapshotUseCase;
import com.smarterd.application.diagram.command.SaveDiagramUseCase;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class DiagramControllerTest {

    @Mock
    private DiagramService diagramService;

    @Mock
    private SaveDiagramUseCase saveDiagramUseCase;

    @Mock
    private PersistDiagramSnapshotUseCase persistDiagramSnapshotUseCase;

    @Test
    void saveDiagram_returnsOkResponseWithLatestSaveState() {
        final var controller = new DiagramController(diagramService, saveDiagramUseCase, persistDiagramSnapshotUseCase);
        final var jwt = jwt("tester");
        final var request = new SaveDiagramRequest("{\"nodes\":[]}", new byte[] { 0x01, 0x02 });
        final var result = new SaveDiagramResult(17L, true, 17L, Instant.parse("2026-03-23T12:00:00Z"), Instant.parse("2026-03-23T12:00:01Z"));

        when(saveDiagramUseCase.execute("tester", 1L, 10L, 100L, request.content(), request.ydocSnapshot()))
            .thenReturn(result);

        final var response = controller.saveDiagram(jwt, 1L, 10L, 100L, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().contentRevision()).isEqualTo("17");
        assertThat(response.getBody().hasYdocSnapshot()).isTrue();
        verify(saveDiagramUseCase).execute("tester", 1L, 10L, 100L, request.content(), request.ydocSnapshot());
    }

    @Test
    void persistYdocSnapshot_returnsPersistenceResultBody() {
        final var controller = new DiagramController(diagramService, saveDiagramUseCase, persistDiagramSnapshotUseCase);
        final var jwt = jwt("tester");
        final var request = new PersistYdocSnapshotRequest("17", new byte[] { 0x11 });

        when(persistDiagramSnapshotUseCase.execute("tester", 1L, 10L, 100L, "17", request.ydocSnapshot()))
            .thenReturn(false);

        final var response = controller.persistYdocSnapshot(jwt, 1L, 10L, 100L, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().persisted()).isFalse();
        verify(persistDiagramSnapshotUseCase).execute("tester", 1L, 10L, 100L, "17", request.ydocSnapshot());
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject(subject)
            .build();
    }
}
