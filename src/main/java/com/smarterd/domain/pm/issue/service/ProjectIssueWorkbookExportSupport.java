package com.smarterd.domain.pm.issue.service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 이슈 워크북 작성 지원.
 */
final class ProjectIssueWorkbookExportSupport {

    static final List<String> HEADERS = List.of("상태", "우선순위", "제목", "담당자", "내용", "생성일", "수정일");
    static final int[] COLUMN_WIDTHS = { 18 * 256, 14 * 256, 32 * 256, 20 * 256, 56 * 256, 24 * 256, 24 * 256 };
    private static final DateTimeFormatter TIMESTAMP_FORMATTER = DateTimeFormatter.ISO_INSTANT;

    private ProjectIssueWorkbookExportSupport() {}

    /**
     * 기본 제목/헤더/스타일이 포함된 워크북 템플릿을 생성한다.
     *
     * @param title 워크북 제목
     * @return 워크북 템플릿
     */
    static WorkbookTemplate createTemplate(String title) {
        final var workbook = new XSSFWorkbook();
        final var sheet = workbook.createSheet("프로젝트 이슈");

        final var titleStyle = createTitleStyle(workbook);
        final var headerStyle = createHeaderStyle(workbook);
        final var bodyStyle = createBodyStyle(workbook);

        final var titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(28);
        final var titleCell = titleRow.createCell(0);
        titleCell.setCellValue(title);
        titleCell.setCellStyle(titleStyle);
        for (var index = 1; index < HEADERS.size(); index++) {
            titleRow.createCell(index).setCellStyle(titleStyle);
        }
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, HEADERS.size() - 1));

        final var headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(24);
        for (var index = 0; index < HEADERS.size(); index++) {
            final var cell = headerRow.createCell(index);
            cell.setCellValue(HEADERS.get(index));
            cell.setCellStyle(headerStyle);
        }

        for (var index = 0; index < COLUMN_WIDTHS.length; index++) {
            sheet.setColumnWidth(index, COLUMN_WIDTHS[index]);
        }
        sheet.createFreezePane(0, 2);
        sheet.setAutoFilter(new CellRangeAddress(1, 1, 0, HEADERS.size() - 1));

        return new WorkbookTemplate(workbook, sheet, bodyStyle);
    }

    /**
     * 사용자 텍스트를 일반 문자열 셀로 기록한다.
     *
     * @param row 대상 행
     * @param columnIndex 컬럼 인덱스
     * @param value 셀 값
     * @param style 적용 스타일
     */
    static void writeTextCell(Row row, int columnIndex, @Nullable String value, XSSFCellStyle style) {
        final var cell = row.createCell(columnIndex);
        // User content is always written as plain string cells, never as Excel formulas.
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    /**
     * 시각 값을 ISO-8601 문자열 셀로 기록한다.
     *
     * @param row 대상 행
     * @param columnIndex 컬럼 인덱스
     * @param value 시각 값
     * @param style 적용 스타일
     */
    static void writeInstantCell(Row row, int columnIndex, @Nullable Instant value, XSSFCellStyle style) {
        writeTextCell(
            row,
            columnIndex,
            value == null ? "" : TIMESTAMP_FORMATTER.format(value.atOffset(ZoneOffset.UTC)),
            style
        );
    }

    /**
     * 제목 셀 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 제목 스타일
     */
    private static XSSFCellStyle createTitleStyle(XSSFWorkbook workbook) {
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
     * @param workbook 대상 워크북
     * @return 헤더 스타일
     */
    private static XSSFCellStyle createHeaderStyle(XSSFWorkbook workbook) {
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
     * 본문 셀 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 본문 스타일
     */
    private static XSSFCellStyle createBodyStyle(XSSFWorkbook workbook) {
        final var style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setWrapText(true);
        return style;
    }

    record WorkbookTemplate(XSSFWorkbook workbook, org.apache.poi.ss.usermodel.Sheet sheet, XSSFCellStyle bodyStyle) {}
}
