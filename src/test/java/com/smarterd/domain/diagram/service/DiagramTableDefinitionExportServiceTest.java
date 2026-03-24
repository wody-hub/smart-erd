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
class DiagramTableDefinitionExportServiceTest {

    @Mock
    private DiagramService diagramService;

    @Test
    void generateTableDefinition_buildsWorkbookFromDiagramContent() {
        final var service = new DiagramTableDefinitionExportService(diagramService, new ObjectMapper());
        final var diagram = buildDiagram(
            """
                {"nodes":[
                  {"id":"table-1","type":"table","position":{"x":100,"y":100},"data":{
                    "label":"send_email_history",
                    "logicalTableName":"이메일 발송 히스토리",
                    "columns":[{"id":"c1","name":"id","type":"BIGINT"}]
                  }}
                ],"edges":[],"groups":[]}
                """
        );
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);

        final var excelData = service.generateTableDefinition("tester", 1L, 10L, 100L, null);
        final var sheet = excelData.excelBook().getSheetAt(0);

        assertThat(excelData.fileName()).isEqualTo("mail-diagram-table-definition");
        assertThat(sheet.getSheetName()).isEqualTo("테이블 정의서");
        assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("데이터베이스 정의");
        assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("NO");
        assertThat(sheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("common");
        assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("riskzero");
        assertThat(sheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("이메일 발송 히스토리");
        assertThat(sheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("send_email_history");
        assertThat(sheet.getRow(2).getCell(5).getStringCellValue()).isEqualTo("일반 테이블");
        assertThat(sheet.getRow(2).getCell(6).getStringCellValue()).isEqualTo("이메일 발송 히스토리");
        assertThat(sheet.getRow(2).getCell(8).getStringCellValue()).isEqualTo("수시");
    }

    @Test
    void generateTableDefinition_prefersContentOverride() {
        final var service = new DiagramTableDefinitionExportService(diagramService, new ObjectMapper());
        final var diagram = buildDiagram(
            """
                {"nodes":[
                  {"id":"table-1","data":{"label":"saved_table","logicalTableName":"저장 테이블","columns":[]}}
                ],"edges":[],"groups":[]}
                """
        );
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);

        final var excelData = service.generateTableDefinition(
            "tester",
            1L,
            10L,
            100L,
            """
                {"nodes":[
                  {"id":"table-1","data":{"label":"override_table","logicalTableName":"현재 테이블","columns":[]}}
                ],"edges":[],"groups":[]}
                """
        );

        final var sheet = excelData.excelBook().getSheetAt(0);
        assertThat(sheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("현재 테이블");
        assertThat(sheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("override_table");
    }

    @Test
    void generateTableDefinition_throwsWhenContentIsInvalidJson() {
        final var service = new DiagramTableDefinitionExportService(diagramService, new ObjectMapper());
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(buildDiagram("{invalid"));

        assertThatThrownBy(() -> service.generateTableDefinition("tester", 1L, 10L, 100L, null))
            .isInstanceOf(BusinessException.class);
    }

    private Diagram buildDiagram(String content) {
        final var owner = User.builder()
            .loginId("riskzero")
            .password("hashed")
            .name("Risk Zero")
            .build();
        final var team = Team.builder()
            .name("core-team")
            .owner(owner)
            .build();
        final var project = Project.builder()
            .name("common")
            .description("Shared database")
            .team(team)
            .build();
        return Diagram.builder()
            .name("mail-diagram")
            .project(project)
            .content(content)
            .build();
    }
}
