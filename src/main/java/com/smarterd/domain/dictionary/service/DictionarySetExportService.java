package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.dictionary.service.DictionaryWorkbookExportSupport.DictionaryWorkbookStyles;
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import lombok.RequiredArgsConstructor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사전 세트의 단어·용어·도메인을 하나의 엑셀 파일(3시트)로 생성한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DictionarySetExportService {

    private final WordService wordService;
    private final TermService termService;
    private final DomainService domainService;

    /**
     * 사전 세트의 단어·용어·도메인을 하나의 엑셀 파일(3시트)로 생성한다.
     *
     * <p>각 도메인 서비스의 {@code getXxxForExport()}가 내부적으로 멤버십을 검증하므로
     * 별도 인가 검증은 수행하지 않는다. JPA 1차 캐시가 동일 트랜잭션 내에서
     * 중복 엔티티 조회를 완화한다.</p>
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @return 3시트 포함 엑셀 데이터
     */
    public ExcelData generateAllDictionary(String loginId, Long teamId, Long setId) {
        final var wordExport = wordService.getWordsForExport(loginId, teamId, setId);
        final var termExport = termService.getTermsForExport(loginId, teamId, setId);
        final var domainExport = domainService.getDomainsForExport(loginId, teamId, setId);

        final var workbook = new XSSFWorkbook();
        final var styles = DictionaryWorkbookExportSupport.createStyles(workbook);

        writeWordSheet(workbook, styles, wordExport);
        writeTermSheet(workbook, styles, termExport);
        writeDomainSheet(workbook, styles, domainExport);

        final var setName = AppStringUtils.defaultIfBlank(wordExport.dictionarySetName(), "dictionary-set");
        return new ExcelData(workbook, setName + "-dictionary-all");
    }

    /**
     * 단어 사전 시트를 작성한다.
     *
     * @param workbook    대상 워크북
     * @param styles      공유 스타일
     * @param exportResult 단어 내보내기 결과
     */
    private void writeWordSheet(
        XSSFWorkbook workbook,
        DictionaryWorkbookStyles styles,
        WordService.WordExportResult exportResult
    ) {
        final var template = DictionaryWorkbookExportSupport.createTemplate(
            workbook,
            styles,
            DictionaryWorkbookExportSupport.WORD_SHEET_NAME,
            DictionaryWorkbookExportSupport.WORD_TITLE,
            DictionaryWorkbookExportSupport.WORD_HEADERS,
            DictionaryWorkbookExportSupport.WORD_COLUMN_WIDTHS
        );
        DictionaryWorkbookExportSupport.writeWordRows(template.sheet(), styles.bodyStyle(), exportResult.words());
    }

    /**
     * 용어 사전 시트를 작성한다.
     *
     * @param workbook    대상 워크북
     * @param styles      공유 스타일
     * @param exportResult 용어 내보내기 결과
     */
    private void writeTermSheet(
        XSSFWorkbook workbook,
        DictionaryWorkbookStyles styles,
        TermService.TermExportResult exportResult
    ) {
        final var template = DictionaryWorkbookExportSupport.createTemplate(
            workbook,
            styles,
            DictionaryWorkbookExportSupport.TERM_SHEET_NAME,
            DictionaryWorkbookExportSupport.TERM_TITLE,
            DictionaryWorkbookExportSupport.TERM_HEADERS,
            DictionaryWorkbookExportSupport.TERM_COLUMN_WIDTHS
        );
        DictionaryWorkbookExportSupport.writeTermRows(template.sheet(), styles.bodyStyle(), exportResult.terms());
    }

    /**
     * 도메인 사전 시트를 작성한다.
     *
     * @param workbook    대상 워크북
     * @param styles      공유 스타일
     * @param exportResult 도메인 내보내기 결과
     */
    private void writeDomainSheet(
        XSSFWorkbook workbook,
        DictionaryWorkbookStyles styles,
        DomainService.DomainExportResult exportResult
    ) {
        final var template = DictionaryWorkbookExportSupport.createTemplate(
            workbook,
            styles,
            DictionaryWorkbookExportSupport.DOMAIN_SHEET_NAME,
            DictionaryWorkbookExportSupport.DOMAIN_TITLE,
            DictionaryWorkbookExportSupport.DOMAIN_HEADERS,
            DictionaryWorkbookExportSupport.DOMAIN_COLUMN_WIDTHS
        );
        DictionaryWorkbookExportSupport.writeDomainRows(
            template.sheet(),
            styles.bodyStyle(),
            styles.centeredBodyStyle(),
            exportResult.domains()
        );
    }
}
