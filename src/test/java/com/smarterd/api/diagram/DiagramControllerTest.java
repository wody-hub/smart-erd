package com.smarterd.api.diagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.api.diagram.dto.ExportDiagramWorkbookRequest;
import com.smarterd.api.diagram.dto.PersistYdocSnapshotRequest;
import com.smarterd.api.diagram.dto.SaveDiagramRequest;
import com.smarterd.domain.diagram.service.DiagramColumnDefinitionExportService;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.DiagramTableDefinitionExportService;
import com.smarterd.domain.diagram.service.DiagramService.SaveDiagramResult;
import com.smarterd.utils.excel.ExcelData;
import com.smarterd.application.diagram.command.PersistDiagramSnapshotUseCase;
import com.smarterd.application.diagram.command.SaveDiagramUseCase;
import java.time.Instant;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class DiagramControllerTest {

    @Mock
    private DiagramService diagramService;

    @Mock
    private SaveDiagramUseCase saveDiagramUseCase;

    @Mock
    private PersistDiagramSnapshotUseCase persistDiagramSnapshotUseCase;

    @Mock
    private DiagramTableDefinitionExportService diagramTableDefinitionExportService;

    @Mock
    private DiagramColumnDefinitionExportService diagramColumnDefinitionExportService;

    @Test
    void saveDiagram_returnsOkResponseWithLatestSaveState() {
        final var controller = new DiagramController(
            diagramService,
            saveDiagramUseCase,
            persistDiagramSnapshotUseCase,
            diagramTableDefinitionExportService,
            diagramColumnDefinitionExportService
        );
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
        final var controller = new DiagramController(
            diagramService,
            saveDiagramUseCase,
            persistDiagramSnapshotUseCase,
            diagramTableDefinitionExportService,
            diagramColumnDefinitionExportService
        );
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

    @Test
    void downloadTableDefinition_streamsExcelResponse() throws Exception {
        final var controller = new DiagramController(
            diagramService,
            saveDiagramUseCase,
            persistDiagramSnapshotUseCase,
            diagramTableDefinitionExportService,
            diagramColumnDefinitionExportService
        );
        final var jwt = jwt("tester");
        final var workbook = new XSSFWorkbook();
        workbook.createSheet("테이블 정의서").createRow(0).createCell(0).setCellValue("데이터베이스 정의");
        final var response = new MockHttpServletResponse();
        final var request = new ExportDiagramWorkbookRequest("{\"nodes\":[]}");

        when(diagramTableDefinitionExportService.generateTableDefinition("tester", 1L, 10L, 100L, request.content()))
            .thenReturn(new ExcelData(workbook, "diagram-table-definition"));

        controller.downloadTableDefinition(jwt, 1L, 10L, 100L, request, response);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getContentType())
            .isEqualTo("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        assertThat(response.getHeader("Content-Disposition")).contains("diagram-table-definition.xlsx");
        verify(diagramTableDefinitionExportService)
            .generateTableDefinition("tester", 1L, 10L, 100L, request.content());
    }

    @Test
    void downloadColumnDefinition_streamsExcelResponse() throws Exception {
        final var controller = new DiagramController(
            diagramService,
            saveDiagramUseCase,
            persistDiagramSnapshotUseCase,
            diagramTableDefinitionExportService,
            diagramColumnDefinitionExportService
        );
        final var jwt = jwt("tester");
        final var workbook = new XSSFWorkbook();
        workbook.createSheet("컬럼 정의서").createRow(0).createCell(0).setCellValue("컬럼 정의서");
        final var response = new MockHttpServletResponse();
        final var request = new ExportDiagramWorkbookRequest("{\"nodes\":[]}");

        when(diagramColumnDefinitionExportService.generateColumnDefinition("tester", 1L, 10L, 100L, request.content()))
            .thenReturn(new ExcelData(workbook, "diagram-column-definition"));

        controller.downloadColumnDefinition(jwt, 1L, 10L, 100L, request, response);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getContentType())
            .isEqualTo("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        assertThat(response.getHeader("Content-Disposition")).contains("diagram-column-definition.xlsx");
        verify(diagramColumnDefinitionExportService)
            .generateColumnDefinition("tester", 1L, 10L, 100L, request.content());
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject(subject)
            .build();
    }
}
