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
        final var template = DictionaryWorkbookExportSupport.createTemplate(
            DictionaryWorkbookExportSupport.WORD_SHEET_NAME,
            DictionaryWorkbookExportSupport.WORD_TITLE,
            DictionaryWorkbookExportSupport.WORD_HEADERS,
            DictionaryWorkbookExportSupport.WORD_COLUMN_WIDTHS
        );

        DictionaryWorkbookExportSupport.writeWordRows(template.sheet(), template.bodyStyle(), exportResult.words());

        return new ExcelData(
            template.workbook(),
            AppStringUtils.defaultIfBlank(exportResult.dictionarySetName(), "dictionary-set") + "-word-dictionary"
        );
    }
}
