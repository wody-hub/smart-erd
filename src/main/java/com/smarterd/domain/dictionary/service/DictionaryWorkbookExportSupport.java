package com.smarterd.domain.dictionary.service;

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
 * 사전 엑셀 내보내기용 공통 워크북 템플릿을 생성한다.
 */
final class DictionaryWorkbookExportSupport {

    private DictionaryWorkbookExportSupport() {}

    static DictionaryWorkbookTemplate createTemplate(
        String sheetName,
        String title,
        List<String> headers,
        int[] columnWidths
    ) {
        final var workbook = new XSSFWorkbook();
        final var sheet = workbook.createSheet(sheetName);

        final var titleStyle = createTitleStyle(workbook);
        final var headerStyle = createHeaderStyle(workbook);
        final var bodyStyle = createBodyStyle(workbook, HorizontalAlignment.LEFT);
        final var centeredBodyStyle = createBodyStyle(workbook, HorizontalAlignment.CENTER);

        final var titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(28F);
        writeCell(titleRow, 0, title, titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.size() - 1));

        final var headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(22F);
        for (var columnIndex = 0; columnIndex < headers.size(); columnIndex++) {
            writeCell(headerRow, columnIndex, headers.get(columnIndex), headerStyle);
            sheet.setColumnWidth(columnIndex, columnWidths[columnIndex]);
        }

        sheet.createFreezePane(0, 2);
        return new DictionaryWorkbookTemplate(workbook, sheet, bodyStyle, centeredBodyStyle);
    }

    static void writeCell(Row row, int columnIndex, String value, XSSFCellStyle style) {
        final var cell = row.createCell(columnIndex);
        cell.setCellStyle(style);
        cell.setCellValue(value);
    }

    static void writeCell(Row row, int columnIndex, long value, XSSFCellStyle style) {
        final var cell = row.createCell(columnIndex);
        cell.setCellStyle(style);
        cell.setCellValue(value);
    }

    private static XSSFCellStyle createTitleStyle(XSSFWorkbook workbook) {
        final var font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);

        final var style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        return style;
    }

    private static XSSFCellStyle createHeaderStyle(XSSFWorkbook workbook) {
        final var font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());

        final var style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setFillForegroundColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        return style;
    }

    private static XSSFCellStyle createBodyStyle(XSSFWorkbook workbook, HorizontalAlignment alignment) {
        final var font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);

        final var style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(alignment);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setWrapText(true);
        return style;
    }

    record DictionaryWorkbookTemplate(
        XSSFWorkbook workbook,
        org.apache.poi.ss.usermodel.Sheet sheet,
        XSSFCellStyle bodyStyle,
        XSSFCellStyle centeredBodyStyle
    ) {}
}
