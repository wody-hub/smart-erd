package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.ExcelUtils;
import com.smarterd.utils.excel.ExcelData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Locale;

/**
 * 벌크 업로드 템플릿 엑셀 생성을 조정한다.
 */
final class BulkTemplateExcelSupport {

    private final BulkTemplateDataSheetStyler dataSheetStyler = new BulkTemplateDataSheetStyler();
    private final BulkTemplateGuideSheetWriter guideSheetWriter;

    BulkTemplateExcelSupport(int maxRows) {
        this.guideSheetWriter = new BulkTemplateGuideSheetWriter(maxRows);
    }

    <T> ExcelData buildTemplateExcel(
        Locale locale,
        BulkTemplateType templateType,
        String sheetNameCode,
        List<String> titleCodes,
        List<T> sampleRows,
        BulkMessageResolver messageResolver
    ) {
        final var titles = titleCodes
            .stream()
            .map((code) -> messageResolver.resolve(code, locale))
            .toList();
        try (final var utils = new ExcelUtils<>(sampleRows, titles)) {
            utils.sheetName(messageResolver.resolve(sheetNameCode, locale));
            final var excelData = utils.toExcel();
            dataSheetStyler.styleTemplateDataSheet(excelData.excelBook().getSheetAt(0));
            guideSheetWriter.addGuideSheet(excelData.excelBook(), locale, templateType, messageResolver);
            excelData.excelBook().setActiveSheet(0);
            excelData.excelBook().setSelectedTab(0);
            return excelData;
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to release Excel template resources", e);
        }
    }
}
