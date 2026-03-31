package com.smarterd.utils.excel;

import static org.assertj.core.api.Assertions.assertThat;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;

class ExcelWriterDownloadTest {

    @Test
    void download_usesPlainAsciiFilenameForAsciiNames() throws Exception {
        final var workbook = new XSSFWorkbook();
        workbook.createSheet("Sheet1");
        final var response = new MockHttpServletResponse();

        ExcelWriter.download(new ExcelData(workbook, "word-dictionary"), response);

        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION)).isEqualTo(
            "attachment; filename=\"word-dictionary.xlsx\""
        );
    }

    @Test
    void download_usesAsciiFallbackAndUtf8FilenameForNonAsciiNames() throws Exception {
        final var workbook = new XSSFWorkbook();
        workbook.createSheet("Sheet1");
        final var response = new MockHttpServletResponse();

        ExcelWriter.download(new ExcelData(workbook, "기본사전-word-dictionary"), response);

        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION)).isEqualTo(
            "attachment; filename=\"word-dictionary.xlsx\"; filename*=UTF-8''%EA%B8%B0%EB%B3%B8%EC%82%AC%EC%A0%84-word-dictionary.xlsx"
        );
    }
}
