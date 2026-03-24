package com.smarterd.domain.diagram.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램의 테이블 정의서 엑셀 다운로드를 생성한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiagramTableDefinitionExportService {

    private static final String SHEET_NAME = "테이블 정의서";
    private static final String TITLE = "데이터베이스 정의";
    private static final String DEFAULT_TABLE_TYPE = "일반 테이블";
    private static final String DEFAULT_OCCURRENCE_CYCLE = "수시";
    private static final float TITLE_ROW_HEIGHT = 28F;
    private static final float HEADER_ROW_HEIGHT = 22F;
    private static final List<String> HEADERS = List.of(
        "NO",
        "영문 DB명",
        "테이블 소유자",
        "한글 테이블명",
        "영문 테이블명",
        "테이블 유형",
        "관련 엔터티명",
        "테이블 설명",
        "발생주기",
        "비고",
        "데이터건수"
    );
    private static final int[] COLUMN_WIDTHS = {
        8 * 256,
        16 * 256,
        16 * 256,
        28 * 256,
        28 * 256,
        14 * 256,
        24 * 256,
        28 * 256,
        10 * 256,
        18 * 256,
        10 * 256,
    };

    private final DiagramService diagramService;
    private final ObjectMapper objectMapper;

    /**
     * 테이블 정의서 엑셀을 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param contentOverride 현재 캔버스 기준 직렬화 JSON (nullable)
     * @return 엑셀 데이터
     */
    public ExcelData generateTableDefinition(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        @Nullable String contentOverride
    ) {
        final var diagram = diagramService.loadReadableDiagram(loginId, teamId, projectId, diagramId);
        final var content = AppStringUtils.defaultIfBlank(contentOverride, diagram.getContent());
        final var rows = extractRows(diagram, content);
        return buildWorkbook(diagram.getName(), rows);
    }

    /**
     * 다이어그램 JSON에서 테이블 정의서 행을 추출한다.
     *
     * @param diagram 대상 다이어그램
     * @param content 직렬화된 다이어그램 JSON
     * @return 정의서 행 목록
     */
    private List<TableDefinitionRow> extractRows(
        com.smarterd.domain.diagram.entity.Diagram diagram,
        @Nullable String content
    ) {
        if (AppStringUtils.isBlank(content)) {
            return List.of();
        }

        try {
            final var rootNode = objectMapper.readTree(content);
            final var nodesNode = rootNode.path("nodes");
            if (!(nodesNode instanceof ArrayNode nodesArray)) {
                return List.of();
            }

            final var databaseName = AppStringUtils.defaultIfBlank(diagram.getProject().getName(), "");
            final var ownerLoginId = AppStringUtils.defaultIfBlank(
                diagram.getProject().getTeam().getOwner().getLoginId(),
                ""
            );

            final List<TableDefinitionRow> rows = new ArrayList<>();
            var index = 1;
            for (final var node : nodesArray) {
                final var dataNode = node.path("data");
                if (!dataNode.isObject()) {
                    continue;
                }

                final var physicalTableName = trimToEmpty(dataNode.path("label"));
                if (physicalTableName.isEmpty()) {
                    continue;
                }

                final var logicalTableName = AppStringUtils.defaultIfBlank(
                    trimToEmpty(dataNode.path("logicalTableName")),
                    physicalTableName
                );

                rows.add(
                    new TableDefinitionRow(
                        index++,
                        databaseName,
                        ownerLoginId,
                        logicalTableName,
                        physicalTableName,
                        DEFAULT_TABLE_TYPE,
                        logicalTableName,
                        "",
                        DEFAULT_OCCURRENCE_CYCLE,
                        "",
                        ""
                    )
                );
            }

            return rows;
        } catch (JsonProcessingException exception) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DIAGRAM_CONTENT_INVALID_JSON.code());
        }
    }

    /**
     * 테이블 정의서 워크북을 생성한다.
     *
     * @param diagramName 파일명에 사용할 다이어그램 이름
     * @param rows 데이터 행 목록
     * @return 엑셀 데이터
     */
    private ExcelData buildWorkbook(String diagramName, List<TableDefinitionRow> rows) {
        final var template = DiagramDefinitionWorkbookSupport.createTemplate(
            SHEET_NAME,
            TITLE,
            HEADERS,
            COLUMN_WIDTHS,
            TITLE_ROW_HEIGHT,
            HEADER_ROW_HEIGHT
        );
        final var workbook = template.workbook();
        final var sheet = template.sheet();
        final var bodyStyle = template.bodyStyle();
        final var centeredBodyStyle = template.centeredBodyStyle();

        for (var rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            final var row = sheet.createRow(rowIndex + 2);
            final var definitionRow = rows.get(rowIndex);
            DiagramDefinitionWorkbookSupport.writeCell(row, 0, definitionRow.no(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 1, definitionRow.databaseName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 2, definitionRow.tableOwner(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 3, definitionRow.logicalTableName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 4, definitionRow.physicalTableName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 5, definitionRow.tableType(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 6, definitionRow.relatedEntityName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 7, definitionRow.tableDescription(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 8, definitionRow.occurrenceCycle(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 9, definitionRow.remark(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 10, definitionRow.dataCount(), centeredBodyStyle);
        }

        return new ExcelData(
            workbook,
            AppStringUtils.defaultIfBlank(diagramName, "diagram") + "-table-definition"
        );
    }

    /**
     * JsonNode 문자열 값을 trim한 뒤 반환한다.
     *
     * @param node JSON 노드
     * @return trim된 문자열. 없으면 빈 문자열
     */
    private String trimToEmpty(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        return AppStringUtils.defaultIfBlank(node.asText(null), "").trim();
    }

    /**
     * 테이블 정의서 데이터 행.
     *
     * @param no 번호
     * @param databaseName 영문 DB명
     * @param tableOwner 테이블 소유자
     * @param logicalTableName 한글 테이블명
     * @param physicalTableName 영문 테이블명
     * @param tableType 테이블 유형
     * @param relatedEntityName 관련 엔터티명
     * @param tableDescription 테이블 설명
     * @param occurrenceCycle 발생주기
     * @param remark 비고
     * @param dataCount 데이터건수
     */
    private record TableDefinitionRow(
        int no,
        String databaseName,
        String tableOwner,
        String logicalTableName,
        String physicalTableName,
        String tableType,
        String relatedEntityName,
        String tableDescription,
        String occurrenceCycle,
        String remark,
        String dataCount
    ) {}
}
