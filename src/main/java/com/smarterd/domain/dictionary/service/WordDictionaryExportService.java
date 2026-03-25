package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 단어 사전 엑셀 다운로드를 생성한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WordDictionaryExportService {

    private static final String SHEET_NAME = "단어 사전";
    private static final String TITLE = "단어 사전";
    private static final java.util.List<String> HEADERS = java.util.List.of("논리명", "물리명", "설명");
    private static final int[] COLUMN_WIDTHS = { 28 * 256, 28 * 256, 52 * 256 };

    private final WordService wordService;

    /**
     * 단어 사전 엑셀을 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 엑셀 데이터
     */
    public ExcelData generateWordDictionary(String loginId, Long teamId, Long setId) {
        final var exportResult = wordService.getWordsForExport(loginId, teamId, setId);
        final var template = DictionaryWorkbookExportSupport.createTemplate(SHEET_NAME, TITLE, HEADERS, COLUMN_WIDTHS);
        final var sheet = template.sheet();
        final var bodyStyle = template.bodyStyle();

        for (var rowIndex = 0; rowIndex < exportResult.words().size(); rowIndex++) {
            final var rowData = exportResult.words().get(rowIndex);
            final var row = sheet.createRow(rowIndex + 2);
            DictionaryWorkbookExportSupport.writeCell(row, 0, AppStringUtils.defaultIfBlank(rowData.logicalName(), ""), bodyStyle);
            DictionaryWorkbookExportSupport.writeCell(row, 1, AppStringUtils.defaultIfBlank(rowData.physicalName(), ""), bodyStyle);
            DictionaryWorkbookExportSupport.writeCell(row, 2, AppStringUtils.defaultIfBlank(rowData.description(), ""), bodyStyle);
        }

        return new ExcelData(
            template.workbook(),
            AppStringUtils.defaultIfBlank(exportResult.dictionarySetName(), "dictionary-set") + "-word-dictionary"
        );
    }
}
