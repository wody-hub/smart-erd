package com.smarterd.domain.dictionary.service;

/**
 * 용어 벌크 오류 보고서 엑셀 행.
 *
 * @param rowNumber 원본 행 번호
 * @param logicalName 논리명
 * @param physicalName 물리명
 * @param domainLogicalName 도메인 논리명
 * @param description 설명
 * @param errors 오류 메시지
 */
public record TermBulkErrorReportRow(
    int rowNumber,
    String logicalName,
    String physicalName,
    String domainLogicalName,
    String description,
    String errors
) {}
