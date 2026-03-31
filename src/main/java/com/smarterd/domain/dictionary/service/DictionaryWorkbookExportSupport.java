package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.dictionary.service.DomainService.DomainResult;
import com.smarterd.domain.dictionary.service.TermService.TermResult;
import com.smarterd.domain.dictionary.service.WordService.WordResult;
import com.smarterd.utils.AppStringUtils;
import java.util.List;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * 사전 엑셀 내보내기용 공통 워크북 템플릿·스타일·행 작성을 제공한다.
 */
final class DictionaryWorkbookExportSupport {

    // ── 단어 사전 상수 ──

    static final String WORD_SHEET_NAME = "단어 사전";
    static final String WORD_TITLE = "단어 사전";
    static final List<String> WORD_HEADERS = List.of("논리명", "물리명", "설명");
    static final int[] WORD_COLUMN_WIDTHS = { 28 * 256, 28 * 256, 52 * 256 };

    // ── 용어 사전 상수 ──

    static final String TERM_SHEET_NAME = "용어 사전";
    static final String TERM_TITLE = "용어 사전";
    static final List<String> TERM_HEADERS = List.of("논리명", "물리명", "도메인", "설명");
    static final int[] TERM_COLUMN_WIDTHS = { 28 * 256, 28 * 256, 24 * 256, 48 * 256 };

    // ── 도메인 사전 상수 ──

    static final String DOMAIN_SHEET_NAME = "도메인 사전";
    static final String DOMAIN_TITLE = "도메인 사전";
    static final List<String> DOMAIN_HEADERS = List.of(
        "도메인 그룹",
        "도메인명",
        "표준도메인명",
        "데이터 타입",
        "데이터 길이",
        "데이터 소수점 길이",
        "설명"
    );
    static final int[] DOMAIN_COLUMN_WIDTHS = { 22 * 256, 22 * 256, 28 * 256, 18 * 256, 14 * 256, 18 * 256, 52 * 256 };

    private DictionaryWorkbookExportSupport() {}

    // ── 템플릿 생성 ──

    /**
     * 새 워크북을 생성하고 시트·스타일·헤더를 설정한다.
     *
     * @param sheetName    시트명
     * @param title        제목행 텍스트
     * @param headers      헤더 목록
     * @param columnWidths 컬럼 너비 배열
     * @return 템플릿 결과
     */
    static DictionaryWorkbookTemplate createTemplate(
        String sheetName,
        String title,
        List<String> headers,
        int[] columnWidths
    ) {
        final var workbook = new XSSFWorkbook();
        final var styles = createStyles(workbook);
        return createTemplate(workbook, styles, sheetName, title, headers, columnWidths);
    }

    /**
     * 기존 워크북에 시트를 추가한다. 스타일 객체를 시트 간 공유하여 중복 생성을 방지한다.
     *
     * @param workbook     기존 워크북
     * @param styles       공유 스타일
     * @param sheetName    시트명
     * @param title        제목행 텍스트
     * @param headers      헤더 목록
     * @param columnWidths 컬럼 너비 배열
     * @return 템플릿 결과
     */
    static DictionaryWorkbookTemplate createTemplate(
        XSSFWorkbook workbook,
        DictionaryWorkbookStyles styles,
        String sheetName,
        String title,
        List<String> headers,
        int[] columnWidths
    ) {
        final var sheet = workbook.createSheet(sheetName);

        final var titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(28F);
        writeCell(titleRow, 0, title, styles.titleStyle());
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.size() - 1));

        final var headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(22F);
        for (var columnIndex = 0; columnIndex < headers.size(); columnIndex++) {
            writeCell(headerRow, columnIndex, headers.get(columnIndex), styles.headerStyle());
            sheet.setColumnWidth(columnIndex, columnWidths[columnIndex]);
        }

        sheet.createFreezePane(0, 2);
        return new DictionaryWorkbookTemplate(workbook, sheet, styles.bodyStyle(), styles.centeredBodyStyle());
    }

    // ── 스타일 생성 ──

    /**
     * 워크북용 공유 스타일 세트를 한 번 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 스타일 세트
     */
    static DictionaryWorkbookStyles createStyles(XSSFWorkbook workbook) {
        return new DictionaryWorkbookStyles(
            createTitleStyle(workbook),
            createHeaderStyle(workbook),
            createBodyStyle(workbook, HorizontalAlignment.LEFT),
            createBodyStyle(workbook, HorizontalAlignment.CENTER)
        );
    }

    // ── 행 작성 공통 메서드 ──

    /**
     * 단어 데이터 행을 시트에 작성한다.
     *
     * @param sheet     대상 시트
     * @param bodyStyle 본문 셀 스타일
     * @param words     단어 목록
     */
    static void writeWordRows(Sheet sheet, XSSFCellStyle bodyStyle, List<WordResult> words) {
        for (var i = 0; i < words.size(); i++) {
            final var data = words.get(i);
            final var row = sheet.createRow(i + 2);
            writeCell(row, 0, AppStringUtils.defaultIfBlank(data.logicalName(), ""), bodyStyle);
            writeCell(row, 1, AppStringUtils.defaultIfBlank(data.physicalName(), ""), bodyStyle);
            writeCell(row, 2, AppStringUtils.defaultIfBlank(data.description(), ""), bodyStyle);
        }
    }

    /**
     * 용어 데이터 행을 시트에 작성한다.
     *
     * @param sheet     대상 시트
     * @param bodyStyle 본문 셀 스타일
     * @param terms     용어 목록
     */
    static void writeTermRows(Sheet sheet, XSSFCellStyle bodyStyle, List<TermResult> terms) {
        for (var i = 0; i < terms.size(); i++) {
            final var data = terms.get(i);
            final var row = sheet.createRow(i + 2);
            writeCell(row, 0, AppStringUtils.defaultIfBlank(data.logicalName(), ""), bodyStyle);
            writeCell(row, 1, AppStringUtils.defaultIfBlank(data.physicalName(), ""), bodyStyle);
            writeCell(row, 2, AppStringUtils.defaultIfBlank(data.domainLogicalName(), ""), bodyStyle);
            writeCell(row, 3, AppStringUtils.defaultIfBlank(data.description(), ""), bodyStyle);
        }
    }

    /**
     * 도메인 데이터 행을 시트에 작성한다.
     *
     * @param sheet             대상 시트
     * @param bodyStyle         본문 좌측정렬 스타일
     * @param centeredBodyStyle 본문 중앙정렬 스타일
     * @param domains           도메인 목록
     */
    static void writeDomainRows(
        Sheet sheet,
        XSSFCellStyle bodyStyle,
        XSSFCellStyle centeredBodyStyle,
        List<DomainResult> domains
    ) {
        for (var i = 0; i < domains.size(); i++) {
            final var data = domains.get(i);
            final var row = sheet.createRow(i + 2);
            writeCell(row, 0, AppStringUtils.defaultIfBlank(data.domainGroup(), ""), bodyStyle);
            writeCell(row, 1, AppStringUtils.defaultIfBlank(data.domainClassification(), ""), bodyStyle);
            writeCell(row, 2, AppStringUtils.defaultIfBlank(data.logicalName(), ""), bodyStyle);
            writeCell(row, 3, AppStringUtils.defaultIfBlank(data.dataType(), ""), centeredBodyStyle);
            writeCell(row, 4, data.dataLength() != null ? String.valueOf(data.dataLength()) : "", centeredBodyStyle);
            writeCell(row, 5, data.dataScale() != null ? String.valueOf(data.dataScale()) : "", centeredBodyStyle);
            writeCell(row, 6, AppStringUtils.defaultIfBlank(data.description(), ""), bodyStyle);
        }
    }

    // ── 셀 작성 ──

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

    // ── 스타일 팩토리 (private) ──

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

    // ── record ──

    /** 워크북에서 한 번만 생성하여 시트 간 공유하는 스타일 세트. */
    record DictionaryWorkbookStyles(
        XSSFCellStyle titleStyle,
        XSSFCellStyle headerStyle,
        XSSFCellStyle bodyStyle,
        XSSFCellStyle centeredBodyStyle
    ) {}

    /** 시트 생성 결과. */
    record DictionaryWorkbookTemplate(
        XSSFWorkbook workbook,
        Sheet sheet,
        XSSFCellStyle bodyStyle,
        XSSFCellStyle centeredBodyStyle
    ) {}
}
