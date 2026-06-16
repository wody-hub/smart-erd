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
class WordDictionaryExportServiceTest {

    @Mock
    private WordService wordService;

    @Test
    void generateWordDictionary_buildsWorkbookFromExportRows() {
        final var service = new WordDictionaryExportService(wordService);
        when(wordService.getWordsForExport("tester", 1L, 2L)).thenReturn(
            new WordExportResult(
                "기본사전",
                List.of(
                    new WordResult(
                        1L,
                        "사용자",
                        "user",
                        "서비스 사용자",
                        1L,
                        2L,
                        Instant.parse("2026-03-25T00:00:00Z"),
                        Instant.parse("2026-03-25T00:00:00Z")
                    )
                )
            )
        );

        final var excelData = service.generateWordDictionary("tester", 1L, 2L);
        final var sheet = excelData.excelBook().getSheetAt(0);

        assertThat(excelData.fileName()).isEqualTo("기본사전-word-dictionary");
        assertThat(sheet.getSheetName()).isEqualTo("단어 사전");
        assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("단어 사전");
        assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("논리명");
        assertThat(sheet.getRow(2).getCell(0).getStringCellValue()).isEqualTo("사용자");
        assertThat(sheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("user");
        assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("서비스 사용자");
    }
}
