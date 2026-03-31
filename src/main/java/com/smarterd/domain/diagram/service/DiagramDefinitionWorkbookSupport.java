package com.smarterd.domain.diagram.service;

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

/**
 * 정의서 엑셀 워크북 공통 작성 지원.
 */
final class DiagramDefinitionWorkbookSupport {

    private DiagramDefinitionWorkbookSupport() {}

    static DiagramDefinitionWorkbookTemplate createTemplate(
        String sheetName,
        String title,
        List<String> headers,
        int[] columnWidths,
        float titleRowHeight,
        float headerRowHeight
    ) {
        final var workbook = new XSSFWorkbook();
        final var sheet = workbook.createSheet(sheetName);

        final var titleStyle = createTitleStyle(workbook);
        final var headerStyle = createHeaderStyle(workbook);
        final var bodyStyle = createBodyStyle(workbook, HorizontalAlignment.LEFT);
        final var centeredBodyStyle = createBodyStyle(workbook, HorizontalAlignment.CENTER);

        final var titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(titleRowHeight);
        final var titleCell = titleRow.createCell(0);
        titleCell.setCellValue(title);
        titleCell.setCellStyle(titleStyle);
        for (var columnIndex = 1; columnIndex < headers.size(); columnIndex++) {
            titleRow.createCell(columnIndex).setCellStyle(titleStyle);
        }
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.size() - 1));

        final var headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(headerRowHeight);
        for (var columnIndex = 0; columnIndex < headers.size(); columnIndex++) {
            final var cell = headerRow.createCell(columnIndex);
            cell.setCellValue(headers.get(columnIndex));
            cell.setCellStyle(headerStyle);
        }

        for (var columnIndex = 0; columnIndex < columnWidths.length; columnIndex++) {
            sheet.setColumnWidth(columnIndex, columnWidths[columnIndex]);
        }
        sheet.createFreezePane(0, 2);
        sheet.setAutoFilter(new CellRangeAddress(1, 1, 0, headers.size() - 1));

        return new DiagramDefinitionWorkbookTemplate(workbook, sheet, bodyStyle, centeredBodyStyle);
    }

    static void writeCell(Row row, int columnIndex, String value, XSSFCellStyle style) {
        final var cell = row.createCell(columnIndex);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    static void writeCell(Row row, int columnIndex, int value, XSSFCellStyle style) {
        final var cell = row.createCell(columnIndex);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

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

    private static XSSFCellStyle createBodyStyle(XSSFWorkbook workbook, HorizontalAlignment alignment) {
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

    record DiagramDefinitionWorkbookTemplate(
        XSSFWorkbook workbook,
        org.apache.poi.ss.usermodel.Sheet sheet,
        XSSFCellStyle bodyStyle,
        XSSFCellStyle centeredBodyStyle
    ) {}
}
