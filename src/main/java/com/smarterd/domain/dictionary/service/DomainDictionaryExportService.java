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

    private static final String SHEET_NAME = "도메인 사전";
    private static final String TITLE = "도메인 사전";
    private static final java.util.List<String> HEADERS = java.util.List.of(
        "도메인 그룹",
        "도메인명",
        "표준도메인명",
        "데이터 타입",
        "데이터 길이",
        "데이터 소수점 길이",
        "설명"
    );
    private static final int[] COLUMN_WIDTHS = {
        22 * 256,
        22 * 256,
        28 * 256,
        18 * 256,
        14 * 256,
        18 * 256,
        52 * 256,
    };

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
        final var template = DictionaryWorkbookExportSupport.createTemplate(SHEET_NAME, TITLE, HEADERS, COLUMN_WIDTHS);
        final var sheet = template.sheet();
        final var bodyStyle = template.bodyStyle();
        final var centeredBodyStyle = template.centeredBodyStyle();

        for (var rowIndex = 0; rowIndex < exportResult.domains().size(); rowIndex++) {
            final var rowData = exportResult.domains().get(rowIndex);
            final var row = sheet.createRow(rowIndex + 2);
            DictionaryWorkbookExportSupport.writeCell(row, 0, AppStringUtils.defaultIfBlank(rowData.domainGroup(), ""), bodyStyle);
            DictionaryWorkbookExportSupport.writeCell(
                row,
                1,
                AppStringUtils.defaultIfBlank(rowData.domainClassification(), ""),
                bodyStyle
            );
            DictionaryWorkbookExportSupport.writeCell(row, 2, AppStringUtils.defaultIfBlank(rowData.logicalName(), ""), bodyStyle);
            DictionaryWorkbookExportSupport.writeCell(row, 3, AppStringUtils.defaultIfBlank(rowData.dataType(), ""), centeredBodyStyle);
            DictionaryWorkbookExportSupport.writeCell(
                row,
                4,
                rowData.dataLength() != null ? String.valueOf(rowData.dataLength()) : "",
                centeredBodyStyle
            );
            DictionaryWorkbookExportSupport.writeCell(
                row,
                5,
                rowData.dataScale() != null ? String.valueOf(rowData.dataScale()) : "",
                centeredBodyStyle
            );
            DictionaryWorkbookExportSupport.writeCell(row, 6, AppStringUtils.defaultIfBlank(rowData.description(), ""), bodyStyle);
        }

        return new ExcelData(
            template.workbook(),
            AppStringUtils.defaultIfBlank(exportResult.dictionarySetName(), "dictionary-set") + "-domain-dictionary"
        );
    }
}
