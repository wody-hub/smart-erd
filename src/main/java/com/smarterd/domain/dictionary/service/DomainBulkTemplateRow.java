package com.smarterd.domain.dictionary.service;

/**
 * 도메인 벌크 템플릿 엑셀 생성용 행 데이터.
 *
 * @param domainGroup 도메인 그룹
 * @param domainClassification 도메인명
 * @param logicalName 표준 도메인명
 * @param dataType 데이터 타입
 * @param dataLength 데이터 길이
 * @param dataScale 데이터 소수점 길이
 * @param description 설명
 */
public record DomainBulkTemplateRow(
    String domainGroup,
    String domainClassification,
    String logicalName,
    String dataType,
    String dataLength,
    String dataScale,
    String description
) {}
