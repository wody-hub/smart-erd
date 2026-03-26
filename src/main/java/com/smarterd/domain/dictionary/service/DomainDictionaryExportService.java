package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 도메인 사전 엑셀 다운로드를 생성한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DomainDictionaryExportService {

    private final DomainService domainService;

    /**
     * 도메인 사전 엑셀을 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 엑셀 데이터
     */
    public ExcelData generateDomainDictionary(String loginId, Long teamId, Long setId) {
        final var exportResult = domainService.getDomainsForExport(loginId, teamId, setId);
        final var template = DictionaryWorkbookExportSupport.createTemplate(
            DictionaryWorkbookExportSupport.DOMAIN_SHEET_NAME,
            DictionaryWorkbookExportSupport.DOMAIN_TITLE,
            DictionaryWorkbookExportSupport.DOMAIN_HEADERS,
            DictionaryWorkbookExportSupport.DOMAIN_COLUMN_WIDTHS
        );

        DictionaryWorkbookExportSupport.writeDomainRows(
            template.sheet(),
            template.bodyStyle(),
            template.centeredBodyStyle(),
            exportResult.domains()
        );

        return new ExcelData(
            template.workbook(),
            AppStringUtils.defaultIfBlank(exportResult.dictionarySetName(), "dictionary-set") + "-domain-dictionary"
        );
    }
}
