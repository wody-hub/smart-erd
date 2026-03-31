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
class DiagramColumnDefinitionExportServiceTest {

    @Mock
    private DiagramService diagramService;

    @Test
    void generateColumnDefinition_buildsWorkbookFromDiagramContent() {
        final var service = new DiagramColumnDefinitionExportService(diagramService, new ObjectMapper());
        final var diagram = buildDiagram(
            """
            {"nodes":[
              {"id":"table-1","type":"table","data":{
                "label":"common_code",
                "logicalTableName":"공통코드",
                "columns":[
                  {"id":"c1","name":"code_id","logicalName":"코드 ID","type":"varchar(50)","pk":true,"nullable":false},
                  {"id":"c2","name":"parent_code_id","logicalName":"상위 코드 ID","type":"varchar(50)","fk":true,"nullable":true}
                ]
              }},
              {"id":"table-2","type":"table","data":{
                "label":"code_group",
                "logicalTableName":"코드그룹",
                "columns":[
                  {"id":"p1","name":"id","logicalName":"ID","type":"BIGINT","pk":true,"nullable":false}
                ]
              }}
            ],"edges":[
              {"id":"edge-1","source":"table-2","target":"table-1","sourceHandle":"table-2-p1-source-right","targetHandle":"table-1-c2-target-left"}
            ],"groups":[]}
            """
        );
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);

        final var excelData = service.generateColumnDefinition("tester", 1L, 10L, 100L, null);
        final var sheet = excelData.excelBook().getSheetAt(0);

        assertThat(excelData.fileName()).isEqualTo("mail-diagram-column-definition");
        assertThat(sheet.getSheetName()).isEqualTo("컬럼 정의서");
        assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("컬럼 정의서");
        assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("NO");
        assertThat(sheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("common_code");
        assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("코드 ID");
        assertThat(sheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("code_id");
        assertThat(sheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("코드 ID");
        assertThat(sheet.getRow(2).getCell(5).getStringCellValue()).isEqualTo("공통코드");
        assertThat(sheet.getRow(2).getCell(6).getStringCellValue()).isEqualTo("코드 ID");
        assertThat(sheet.getRow(2).getCell(7).getStringCellValue()).isEqualTo("varchar");
        assertThat(sheet.getRow(2).getCell(8).getStringCellValue()).isEqualTo("50");
        assertThat(sheet.getRow(2).getCell(9).getStringCellValue()).isEqualTo("Y");
        assertThat(sheet.getRow(2).getCell(10).getStringCellValue()).isEqualTo("code_id");
        assertThat(sheet.getRow(3).getCell(9).getStringCellValue()).isEqualTo("N");
        assertThat(sheet.getRow(3).getCell(12).getStringCellValue()).isEqualTo("code_group.id");
    }

    @Test
    void generateColumnDefinition_prefersContentOverride() {
        final var service = new DiagramColumnDefinitionExportService(diagramService, new ObjectMapper());
        final var diagram = buildDiagram(
            """
            {"nodes":[
              {"id":"table-1","data":{"label":"saved_table","logicalTableName":"저장 테이블","columns":[{"id":"c1","name":"saved_col","logicalName":"저장 컬럼","type":"BIGINT"}]}}
            ],"edges":[],"groups":[]}
            """
        );
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);

        final var excelData = service.generateColumnDefinition(
            "tester",
            1L,
            10L,
            100L,
            """
            {"nodes":[
              {"id":"table-1","data":{"label":"override_table","logicalTableName":"현재 테이블","columns":[{"id":"c1","name":"override_col","logicalName":"현재 컬럼","type":"VARCHAR(120)"}]}}
            ],"edges":[],"groups":[]}
            """
        );

        final var sheet = excelData.excelBook().getSheetAt(0);
        assertThat(sheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("override_table");
        assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("현재 컬럼");
        assertThat(sheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("override_col");
        assertThat(sheet.getRow(2).getCell(7).getStringCellValue()).isEqualTo("VARCHAR");
        assertThat(sheet.getRow(2).getCell(8).getStringCellValue()).isEqualTo("120");
    }

    @Test
    void generateColumnDefinition_leavesFkInfoBlankWhenFkColumnHasNoResolvedEdge() {
        final var service = new DiagramColumnDefinitionExportService(diagramService, new ObjectMapper());
        final var diagram = buildDiagram(
            """
            {"nodes":[
              {"id":"table-1","data":{"label":"common_code","logicalTableName":"공통코드","columns":[
                {"id":"c1","name":"parent_code_id","logicalName":"상위 코드 ID","type":"varchar(50)","fk":true,"nullable":true}
              ]}}
            ],"edges":[],"groups":[]}
            """
        );
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(diagram);

        final var excelData = service.generateColumnDefinition("tester", 1L, 10L, 100L, null);
        final var sheet = excelData.excelBook().getSheetAt(0);

        assertThat(sheet.getRow(2).getCell(12).getStringCellValue()).isBlank();
    }

    @Test
    void generateColumnDefinition_throwsWhenContentIsInvalidJson() {
        final var service = new DiagramColumnDefinitionExportService(diagramService, new ObjectMapper());
        when(diagramService.loadReadableDiagram("tester", 1L, 10L, 100L)).thenReturn(buildDiagram("{invalid"));

        assertThatThrownBy(() -> service.generateColumnDefinition("tester", 1L, 10L, 100L, null)).isInstanceOf(
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
