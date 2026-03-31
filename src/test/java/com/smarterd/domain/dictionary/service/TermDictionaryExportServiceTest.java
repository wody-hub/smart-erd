package com.smarterd.domain.dictionary.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TermDictionaryExportServiceTest {

    @Mock
    private TermService termService;

    @Test
    void generateTermDictionary_buildsWorkbookFromExportRows() {
        final var service = new TermDictionaryExportService(termService);
        when(termService.getTermsForExport("tester", 1L, 2L)).thenReturn(
            new TermService.TermExportResult(
                "기본사전",
                List.of(
                    new TermService.TermResult(
                        1L,
                        "사용자명",
                        "user_name",
                        "로그인 이름",
                        1L,
                        2L,
                        10L,
                        "이름",
                        Instant.parse("2026-03-25T00:00:00Z"),
                        Instant.parse("2026-03-25T00:00:00Z")
                    )
                )
            )
        );

        final var excelData = service.generateTermDictionary("tester", 1L, 2L);
        final var sheet = excelData.excelBook().getSheetAt(0);

        assertThat(excelData.fileName()).isEqualTo("기본사전-term-dictionary");
        assertThat(sheet.getSheetName()).isEqualTo("용어 사전");
        assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("용어 사전");
        assertThat(sheet.getRow(1).getCell(2).getStringCellValue()).isEqualTo("도메인");
        assertThat(sheet.getRow(2).getCell(0).getStringCellValue()).isEqualTo("사용자명");
        assertThat(sheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("user_name");
        assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("이름");
        assertThat(sheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("로그인 이름");
    }
}
