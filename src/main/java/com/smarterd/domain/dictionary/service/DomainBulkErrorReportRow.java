package com.smarterd.domain.dictionary.service;

/**
 * 도메인 벌크 오류 보고서 엑셀 행.
 *
 * @param rowNumber 원본 행 번호
 * @param domainGroup 도메인 그룹
 * @param domainClassification 도메인명
 * @param logicalName 표준 도메인명
 * @param dataType 데이터 타입
 * @param dataLength 데이터 길이 원본 문자열
 * @param dataScale 데이터 소수점 길이 원본 문자열
 * @param description 설명
 * @param errors 오류 메시지
 */
public record DomainBulkErrorReportRow(
    int rowNumber,
    String domainGroup,
    String domainClassification,
    String logicalName,
    String dataType,
    String dataLength,
    String dataScale,
    String description,
    String errors
) {}
