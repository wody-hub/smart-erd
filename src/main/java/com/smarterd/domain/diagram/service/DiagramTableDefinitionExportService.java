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
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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
        final var workbook = new XSSFWorkbook();
        final var sheet = workbook.createSheet(SHEET_NAME);

        final var titleStyle = createTitleStyle(workbook);
        final var headerStyle = createHeaderStyle(workbook);
        final var bodyStyle = createBodyStyle(workbook, HorizontalAlignment.LEFT);
        final var centeredBodyStyle = createBodyStyle(workbook, HorizontalAlignment.CENTER);

        final var titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(28);
        final var titleCell = titleRow.createCell(0);
        titleCell.setCellValue(TITLE);
        titleCell.setCellStyle(titleStyle);
        for (var columnIndex = 1; columnIndex < HEADERS.size(); columnIndex++) {
            titleRow.createCell(columnIndex).setCellStyle(titleStyle);
        }
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, HEADERS.size() - 1));

        final var headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(22);
        for (var columnIndex = 0; columnIndex < HEADERS.size(); columnIndex++) {
            final var cell = headerRow.createCell(columnIndex);
            cell.setCellValue(HEADERS.get(columnIndex));
            cell.setCellStyle(headerStyle);
        }

        for (var rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            final var row = sheet.createRow(rowIndex + 2);
            final var definitionRow = rows.get(rowIndex);
            writeCell(row, 0, definitionRow.no(), centeredBodyStyle);
            writeCell(row, 1, definitionRow.databaseName(), bodyStyle);
            writeCell(row, 2, definitionRow.tableOwner(), bodyStyle);
            writeCell(row, 3, definitionRow.logicalTableName(), bodyStyle);
            writeCell(row, 4, definitionRow.physicalTableName(), bodyStyle);
            writeCell(row, 5, definitionRow.tableType(), centeredBodyStyle);
            writeCell(row, 6, definitionRow.relatedEntityName(), bodyStyle);
            writeCell(row, 7, definitionRow.tableDescription(), bodyStyle);
            writeCell(row, 8, definitionRow.occurrenceCycle(), centeredBodyStyle);
            writeCell(row, 9, definitionRow.remark(), bodyStyle);
            writeCell(row, 10, definitionRow.dataCount(), centeredBodyStyle);
        }

        for (var columnIndex = 0; columnIndex < COLUMN_WIDTHS.length; columnIndex++) {
            sheet.setColumnWidth(columnIndex, COLUMN_WIDTHS[columnIndex]);
        }
        sheet.createFreezePane(0, 2);
        sheet.setAutoFilter(new CellRangeAddress(1, 1, 0, HEADERS.size() - 1));

        return new ExcelData(
            workbook,
            AppStringUtils.defaultIfBlank(diagramName, "diagram") + "-table-definition"
        );
    }

    /**
     * 제목 셀 스타일을 생성한다.
     *
     * @param workbook 워크북
     * @return 제목 셀 스타일
     */
    private XSSFCellStyle createTitleStyle(XSSFWorkbook workbook) {
        final var style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);

        final XSSFFont font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        return style;
    }

    /**
     * 헤더 셀 스타일을 생성한다.
     *
     * @param workbook 워크북
     * @return 헤더 셀 스타일
     */
    private XSSFCellStyle createHeaderStyle(XSSFWorkbook workbook) {
        final var style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setWrapText(true);

        final XSSFFont font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        return style;
    }

    /**
     * 데이터 셀 스타일을 생성한다.
     *
     * @param workbook 워크북
     * @param alignment 수평 정렬
     * @return 데이터 셀 스타일
     */
    private XSSFCellStyle createBodyStyle(XSSFWorkbook workbook, HorizontalAlignment alignment) {
        final var style = workbook.createCellStyle();
        style.setAlignment(alignment);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setWrapText(true);
        return style;
    }

    /**
     * 문자열 값을 셀에 기록한다.
     *
     * @param row 대상 행
     * @param columnIndex 열 인덱스
     * @param value 기록 값
     * @param style 셀 스타일
     * @returns 없음
     */
    private void writeCell(org.apache.poi.ss.usermodel.Row row, int columnIndex, String value, XSSFCellStyle style) {
        final var cell = row.createCell(columnIndex);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    /**
     * 숫자 값을 셀에 기록한다.
     *
     * @param row 대상 행
     * @param columnIndex 열 인덱스
     * @param value 기록 값
     * @param style 셀 스타일
     * @returns 없음
     */
    private void writeCell(org.apache.poi.ss.usermodel.Row row, int columnIndex, int value, XSSFCellStyle style) {
        final var cell = row.createCell(columnIndex);
        cell.setCellValue(value);
        cell.setCellStyle(style);
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
