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
class DomainDictionaryExportServiceTest {

    @Mock
    private DomainService domainService;

    @Test
    void generateDomainDictionary_buildsWorkbookFromExportRows() {
        final var service = new DomainDictionaryExportService(domainService);
        when(domainService.getDomainsForExport("tester", 1L, 2L)).thenReturn(
            new DomainService.DomainExportResult(
                "기본사전",
                List.of(
                    new DomainService.DomainResult(
                        1L,
                        "금액_DECIMAL15_2",
                        "수치",
                        "금액",
                        "DECIMAL",
                        15,
                        2,
                        "DECIMAL(15,2)",
                        "화폐 금액",
                        1L,
                        2L,
                        Instant.parse("2026-03-25T00:00:00Z"),
                        Instant.parse("2026-03-25T00:00:00Z")
                    )
                )
            )
        );

        final var excelData = service.generateDomainDictionary("tester", 1L, 2L);
        final var sheet = excelData.excelBook().getSheetAt(0);

        assertThat(excelData.fileName()).isEqualTo("기본사전-domain-dictionary");
        assertThat(sheet.getSheetName()).isEqualTo("도메인 사전");
        assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("도메인 사전");
        assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("도메인 그룹");
        assertThat(sheet.getRow(1).getCell(1).getStringCellValue()).isEqualTo("도메인명");
        assertThat(sheet.getRow(1).getCell(3).getStringCellValue()).isEqualTo("데이터 타입");
        assertThat(sheet.getRow(2).getCell(0).getStringCellValue()).isEqualTo("수치");
        assertThat(sheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("금액");
        assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("금액_DECIMAL15_2");
        assertThat(sheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("DECIMAL");
        assertThat(sheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("15");
        assertThat(sheet.getRow(2).getCell(5).getStringCellValue()).isEqualTo("2");
        assertThat(sheet.getRow(2).getCell(6).getStringCellValue()).isEqualTo("화폐 금액");
    }
}
