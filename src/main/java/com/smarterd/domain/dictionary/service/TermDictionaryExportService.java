package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 용어 사전 엑셀 다운로드를 생성한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TermDictionaryExportService {

    private final TermService termService;

    /**
     * 용어 사전 엑셀을 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 엑셀 데이터
     */
    public ExcelData generateTermDictionary(String loginId, Long teamId, Long setId) {
        final var exportResult = termService.getTermsForExport(loginId, teamId, setId);
        final var template = DictionaryWorkbookExportSupport.createTemplate(
            DictionaryWorkbookExportSupport.TERM_SHEET_NAME,
            DictionaryWorkbookExportSupport.TERM_TITLE,
            DictionaryWorkbookExportSupport.TERM_HEADERS,
            DictionaryWorkbookExportSupport.TERM_COLUMN_WIDTHS
        );

        DictionaryWorkbookExportSupport.writeTermRows(template.sheet(), template.bodyStyle(), exportResult.terms());

        return new ExcelData(
            template.workbook(),
            AppStringUtils.defaultIfBlank(exportResult.dictionarySetName(), "dictionary-set") + "-term-dictionary"
        );
    }
}
