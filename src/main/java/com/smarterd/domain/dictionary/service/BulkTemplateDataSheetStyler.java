package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;

/**
 * 벌크 템플릿 데이터 시트의 헤더와 샘플 행 스타일을 적용한다.
 */
final class BulkTemplateDataSheetStyler {

    private final BulkTemplateCellStyleFactory styleFactory = new BulkTemplateCellStyleFactory();

    void styleTemplateDataSheet(Sheet dataSheet) {
        if (dataSheet == null) {
            return;
        }

        dataSheet.setDisplayGridlines(false);
        dataSheet.createFreezePane(0, 1);
        dataSheet.setZoom(120);

        final var workbook = dataSheet.getWorkbook();
        final var headerRequiredStyle = styleFactory.createTemplateHeaderStyle(workbook, true);
        final var headerOptionalStyle = styleFactory.createTemplateHeaderStyle(workbook, false);
        final var sampleStyle = styleFactory.createTemplateSampleStyle(workbook);
        final var headerRow = dataSheet.getRow(0);
        if (headerRow == null || headerRow.getLastCellNum() < 0) {
            return;
        }

        final var lastColumnIndex = styleHeaderRow(headerRow, headerRequiredStyle, headerOptionalStyle);
        styleSampleRows(dataSheet, lastColumnIndex, sampleStyle);
        dataSheet.setAutoFilter(new CellRangeAddress(0, 0, 0, lastColumnIndex));
        fitColumns(dataSheet, lastColumnIndex);
    }

    /** @param headerRow 헤더 행 @param headerRequiredStyle 필수 스타일 @param headerOptionalStyle 선택 스타일 @return 마지막 컬럼 인덱스 */
    private int styleHeaderRow(Row headerRow, CellStyle headerRequiredStyle, CellStyle headerOptionalStyle) {
        headerRow.setHeightInPoints(24);
        final var lastColumnIndex = headerRow.getLastCellNum() - 1;
        for (var columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex++) {
            final var headerCell = headerRow.getCell(columnIndex);
            if (headerCell == null) {
                continue;
            }
            final var headerValue = AppStringUtils.trimToEmpty(headerCell.getStringCellValue());
            headerCell.setCellStyle(isRequiredHeader(headerValue) ? headerRequiredStyle : headerOptionalStyle);
        }
        return lastColumnIndex;
    }

    /** @param dataSheet 데이터 시트 @param lastColumnIndex 마지막 컬럼 인덱스 @param sampleStyle 샘플 셀 스타일 */
    private void styleSampleRows(Sheet dataSheet, int lastColumnIndex, CellStyle sampleStyle) {
        for (var rowIndex = 1; rowIndex <= dataSheet.getLastRowNum(); rowIndex++) {
            final var row = dataSheet.getRow(rowIndex);
            if (row == null) {
                continue;
            }
            row.setHeightInPoints(21);
            for (var columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex++) {
                final var cell = row.getCell(columnIndex);
                if (cell == null) {
                    continue;
                }
                cell.setCellStyle(sampleStyle);
            }
        }
    }

    /** @param dataSheet 데이터 시트 @param lastColumnIndex 마지막 컬럼 인덱스 */
    private void fitColumns(Sheet dataSheet, int lastColumnIndex) {
        for (var columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex++) {
            dataSheet.autoSizeColumn(columnIndex);
            final var currentWidth = dataSheet.getColumnWidth(columnIndex);
            dataSheet.setColumnWidth(columnIndex, Math.min(currentWidth + 1024, 48 * 256));
        }
    }

    /** @param headerValue 헤더 문자열 @return 필수 컬럼 헤더이면 true */
    private boolean isRequiredHeader(String headerValue) {
        return headerValue.contains("필수") || AppStringUtils.containsIgnoreCase(headerValue, "required");
    }
}
