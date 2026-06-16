package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import java.util.Locale;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;

/**
 * 벌크 템플릿 가이드 시트를 작성한다.
 */
final class BulkTemplateGuideSheetWriter {

    private final int maxRows;
    private final BulkTemplateCellStyleFactory styleFactory = new BulkTemplateCellStyleFactory();

    BulkTemplateGuideSheetWriter(int maxRows) {
        this.maxRows = maxRows;
    }

    void addGuideSheet(
        Workbook workbook,
        Locale locale,
        BulkTemplateType templateType,
        BulkMessageResolver messageResolver
    ) {
        final var guideSheet = workbook.createSheet(messageResolver.resolve("template.guide.sheet-name", locale));
        guideSheet.setDisplayGridlines(false);
        guideSheet.setColumnWidth(0, 18 * 256);
        guideSheet.setColumnWidth(1, 20 * 256);
        guideSheet.setColumnWidth(2, 18 * 256);
        guideSheet.setColumnWidth(3, 44 * 256);

        var rowIndex = writeHeroRows(guideSheet, messageResolver, locale);
        rowIndex = writeSummaryRows(guideSheet, rowIndex + 1, templateType, messageResolver, locale);
        writeInstructionRows(guideSheet, rowIndex + 1, templateType, messageResolver, locale);
    }

    /** @param guideSheet 가이드 시트 @param messageResolver 메시지 해석 함수 @param locale 로케일 @return 다음 행 인덱스 */
    private int writeHeroRows(Sheet guideSheet, BulkMessageResolver messageResolver, Locale locale) {
        final var workbook = guideSheet.getWorkbook();
        final var titleStyle = styleFactory.createGuideHeroTitleStyle(workbook);
        final var subtitleStyle = styleFactory.createGuideHeroSubtitleStyle(workbook);

        writeMergedTextRow(guideSheet, 0, messageResolver.resolve("template.guide.title", locale), 24, titleStyle);
        writeMergedTextRow(
            guideSheet,
            1,
            messageResolver.resolve("template.guide.subtitle", locale),
            20,
            subtitleStyle
        );
        return 2;
    }

    /** @param guideSheet 가이드 시트 @param rowIndex 시작 행 @param templateType 템플릿 유형 @param messageResolver 메시지 해석 함수 @param locale 로케일 @return 다음 행 인덱스 */
    private int writeSummaryRows(
        Sheet guideSheet,
        int rowIndex,
        BulkTemplateType templateType,
        BulkMessageResolver messageResolver,
        Locale locale
    ) {
        final var workbook = guideSheet.getWorkbook();
        final var sectionStyle = styleFactory.createGuideSectionStyle(workbook);
        final var labelStyle = styleFactory.createGuideLabelStyle(workbook);
        final var valueStyle = styleFactory.createGuideValueStyle(workbook);

        writeMergedTextRow(
            guideSheet,
            rowIndex++,
            messageResolver.resolve("template.guide.summary.title", locale),
            0,
            sectionStyle
        );
        rowIndex = createSummaryRow(
            guideSheet,
            rowIndex,
            messageResolver.resolve("template.guide.summary.sheet", locale),
            messageResolver.resolve(templateType.sheetNameCode(), locale),
            labelStyle,
            valueStyle
        );
        rowIndex = createSummaryRow(
            guideSheet,
            rowIndex,
            messageResolver.resolve("template.guide.summary.formats", locale),
            ".xlsx, .csv",
            labelStyle,
            valueStyle
        );
        return createSummaryRow(
            guideSheet,
            rowIndex,
            messageResolver.resolve("template.guide.summary.max-rows", locale),
            String.valueOf(maxRows),
            labelStyle,
            valueStyle
        );
    }

    /** @param guideSheet 가이드 시트 @param rowIndex 시작 행 @param templateType 템플릿 유형 @param messageResolver 메시지 해석 함수 @param locale 로케일 */
    private void writeInstructionRows(
        Sheet guideSheet,
        int rowIndex,
        BulkTemplateType templateType,
        BulkMessageResolver messageResolver,
        Locale locale
    ) {
        final var workbook = guideSheet.getWorkbook();
        final var sectionStyle = styleFactory.createGuideSectionStyle(workbook);
        final var indexStyle = styleFactory.createGuideBulletIndexStyle(workbook);
        final var textStyle = styleFactory.createGuideBulletTextStyle(workbook);

        writeMergedTextRow(
            guideSheet,
            rowIndex++,
            messageResolver.resolve("template.guide.instructions.title", locale),
            0,
            sectionStyle
        );
        final var prefix = "template.guide." + templateType.key() + ".instruction.";
        for (var i = 1; i <= templateType.instructionCount(); i++) {
            writeInstructionRow(
                guideSheet,
                rowIndex++,
                i,
                resolveInstructionMessage(prefix, i, templateType, messageResolver, locale),
                indexStyle,
                textStyle
            );
        }
    }

    /** @param prefix 메시지 prefix @param index 안내 번호 @param templateType 템플릿 유형 @param messageResolver 메시지 해석 함수 @param locale 로케일 @return 안내 문구 */
    private String resolveInstructionMessage(
        String prefix,
        int index,
        BulkTemplateType templateType,
        BulkMessageResolver messageResolver,
        Locale locale
    ) {
        final var messageCode = prefix + index;
        return templateType.isMaxRowsInstruction(index)
            ? messageResolver.resolve(messageCode, locale, maxRows)
            : messageResolver.resolve(messageCode, locale);
    }

    /** @param guideSheet 가이드 시트 @param rowIndex 행 인덱스 @param displayIndex 표시 번호 @param message 안내 문구 @param indexStyle 번호 스타일 @param textStyle 본문 스타일 */
    private void writeInstructionRow(
        Sheet guideSheet,
        int rowIndex,
        int displayIndex,
        String message,
        CellStyle indexStyle,
        CellStyle textStyle
    ) {
        final var row = guideSheet.createRow(rowIndex);
        row.setHeightInPoints(22);
        final var indexCell = row.createCell(0);
        indexCell.setCellValue(displayIndex);
        indexCell.setCellStyle(indexStyle);

        final var messageCell = row.createCell(1);
        messageCell.setCellValue(stripInstructionNumber(message));
        messageCell.setCellStyle(textStyle);
        applyMergedRegionStyle(row, 1, 3, textStyle);
        guideSheet.addMergedRegion(new CellRangeAddress(row.getRowNum(), row.getRowNum(), 1, 3));
    }

    /** @param guideSheet 가이드 시트 @param rowIndex 행 인덱스 @param value 셀 값 @param height 행 높이 @param style 셀 스타일 */
    private void writeMergedTextRow(Sheet guideSheet, int rowIndex, String value, int height, CellStyle style) {
        guideSheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, 3));
        final var row = guideSheet.createRow(rowIndex);
        if (height > 0) {
            row.setHeightInPoints(height);
        }
        final var cell = row.createCell(0);
        cell.setCellValue(value);
        cell.setCellStyle(style);
        applyMergedRegionStyle(guideSheet, rowIndex, rowIndex, 0, 3, style);
    }

    /** @param guideSheet 가이드 시트 @param rowIndex 행 인덱스 @param label 라벨 @param value 값 @param labelStyle 라벨 스타일 @param valueStyle 값 스타일 @return 다음 행 인덱스 */
    private int createSummaryRow(
        Sheet guideSheet,
        int rowIndex,
        String label,
        String value,
        CellStyle labelStyle,
        CellStyle valueStyle
    ) {
        final var row = guideSheet.createRow(rowIndex);
        final var labelCell = row.createCell(0);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(labelStyle);

        final var valueCell = row.createCell(1);
        valueCell.setCellValue(value);
        valueCell.setCellStyle(valueStyle);
        applyMergedRegionStyle(row, 1, 3, valueStyle);
        guideSheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 1, 3));
        return rowIndex + 1;
    }

    /** @param sheet 대상 시트 @param firstRow 시작 행 @param lastRow 종료 행 @param firstColumn 시작 열 @param lastColumn 종료 열 @param style 셀 스타일 */
    private void applyMergedRegionStyle(
        Sheet sheet,
        int firstRow,
        int lastRow,
        int firstColumn,
        int lastColumn,
        CellStyle style
    ) {
        for (var rowIndex = firstRow; rowIndex <= lastRow; rowIndex++) {
            final var row = sheet.getRow(rowIndex) == null ? sheet.createRow(rowIndex) : sheet.getRow(rowIndex);
            applyMergedRegionStyle(row, firstColumn, lastColumn, style);
        }
    }

    /** @param row 대상 행 @param firstColumn 시작 열 @param lastColumn 종료 열 @param style 셀 스타일 */
    private void applyMergedRegionStyle(Row row, int firstColumn, int lastColumn, CellStyle style) {
        for (var columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex++) {
            final var cell = row.getCell(columnIndex) == null ? row.createCell(columnIndex) : row.getCell(columnIndex);
            cell.setCellStyle(style);
        }
    }

    /** @param message 원본 안내 메시지 @return 번호 접두사가 제거된 문자열 */
    private String stripInstructionNumber(String message) {
        final var normalizedMessage = AppStringUtils.trimToEmpty(message);
        final var separatorIndex = normalizedMessage.indexOf(". ");
        if (separatorIndex < 0) {
            return normalizedMessage;
        }
        return normalizedMessage.substring(separatorIndex + 2);
    }
}
