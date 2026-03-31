package com.smarterd.domain.diagram.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DiagramIndexDefinitionExportServiceTest {

    @Mock
    private DiagramService diagramService;

    @Test
    void generateIndexDefinition_buildsWorkbookFromDiagramContent() {
        final var service = new DiagramIndexDefinitionExportService(diagramService, new ObjectMapper());
        final var diagram = buildDiagram(
            """
            {"nodes":[
              {"id":"table-1","data":{"label":"common_code","logicalTableName":"공통코드","columns":[
                {"id":"c1","name":"code_id","logicalName":"코드 ID","type":"varchar(50)","pk":true,"nullable":false},
                {"id":"c2","name":"parent_code_id","logicalName":"상위 코드 ID","type":"varchar(50)","fk":true,"nullable":true}
              ]}},
              {"id":"table-2","data":{"label":"code_group","logicalTableName":"코드그룹","columns":[
                {"id":"p1","name":"id","logicalName":"ID","type":"BIGINT","pk":true,"nullable":false}
              ]}}
            ],"edges":[],"groups":[]}
            """
        );
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);

        final var excelData = service.generateIndexDefinition("tester", 1L, 10L, 100L, null);
        final var sheet = excelData.excelBook().getSheetAt(0);

        assertThat(excelData.fileName()).isEqualTo("mail-diagram-index-definition");
        assertThat(sheet.getSheetName()).isEqualTo("인덱스 정의서");
        assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("인덱스 정의서");
        assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("영문 DB명");
        assertThat(sheet.getRow(2).getCell(0).getStringCellValue()).isEmpty();
        assertThat(sheet.getRow(2).getCell(1).getStringCellValue()).isEmpty();
        assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("common_code");
        assertThat(sheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("pk_common_code");
        assertThat(sheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("code_id");
        assertThat(sheet.getRow(2).getCell(5).getNumericCellValue()).isEqualTo(1D);
        assertThat(sheet.getRow(3).getCell(3).getStringCellValue()).isEqualTo("idx_common_code_parent_code_id");
        assertThat(sheet.getRow(3).getCell(4).getStringCellValue()).isEqualTo("parent_code_id");
        assertThat(sheet.getRow(4).getCell(3).getStringCellValue()).isEqualTo("pk_code_group");
    }

    @Test
    void generateIndexDefinition_prefersContentOverride() {
        final var service = new DiagramIndexDefinitionExportService(diagramService, new ObjectMapper());
        final var diagram = buildDiagram(
            """
            {"nodes":[
              {"id":"table-1","data":{"label":"saved_table","logicalTableName":"저장 테이블","columns":[{"id":"c1","name":"saved_id","pk":true}]}}
            ],"edges":[],"groups":[]}
            """
        );
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);

        final var excelData = service.generateIndexDefinition(
            "tester",
            1L,
            10L,
            100L,
            """
            {"nodes":[
              {"id":"table-1","data":{"label":"override_table","logicalTableName":"현재 테이블","columns":[{"id":"c1","name":"override_id","pk":true}]}}
            ],"edges":[],"groups":[]}
            """
        );

        final var sheet = excelData.excelBook().getSheetAt(0);
        assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("override_table");
        assertThat(sheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("pk_override_table");
        assertThat(sheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("override_id");
    }

    @Test
    void generateIndexDefinition_usesExplicitExportMetadataWhenProvided() {
        final var service = new DiagramIndexDefinitionExportService(diagramService, new ObjectMapper());
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(buildDiagram("{\"nodes\":[]}"));

        final var excelData = service.generateIndexDefinition(
            "tester",
            1L,
            10L,
            100L,
            """
            {"metadata":{"databaseName":"common","tableOwner":"riskzero"},"nodes":[
              {"id":"table-1","data":{"label":"override_table","logicalTableName":"현재 테이블","columns":[{"id":"c1","name":"override_id","pk":true}]}}
            ],"edges":[],"groups":[]}
            """
        );

        final var sheet = excelData.excelBook().getSheetAt(0);
        assertThat(sheet.getRow(2).getCell(0).getStringCellValue()).isEqualTo("common");
        assertThat(sheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("riskzero");
    }

    @Test
    void generateIndexDefinition_throwsWhenContentIsInvalidJson() {
        final var service = new DiagramIndexDefinitionExportService(diagramService, new ObjectMapper());
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(buildDiagram("{invalid"));

        assertThatThrownBy(() -> service.generateIndexDefinition("tester", 1L, 10L, 100L, null)).isInstanceOf(
            BusinessException.class
        );
    }

    private Diagram buildDiagram(String content) {
        final var owner = User.builder().loginId("riskzero").password("hashed").name("Risk Zero").build();
        final var team = Team.builder().name("core-team").owner(owner).build();
        final var project = Project.builder().name("common").description("Shared database").team(team).build();
        return Diagram.builder().name("mail-diagram").project(project).content(content).build();
    }
}
