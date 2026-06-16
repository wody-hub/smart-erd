package com.smarterd.domain.dictionary.service;

/**
 * 도메인 벌크 저장 단계에서 사용하는 행 모델.
 *
 * @param domainGroup 도메인 그룹
 * @param domainClassification 도메인명
 * @param logicalName 표준 도메인명
 * @param dataType 데이터 타입
 * @param dataLength 데이터 길이
 * @param dataScale 데이터 소수점 길이
 * @param description 설명
 */
record DomainBulkRow(
    String domainGroup,
    String domainClassification,
    String logicalName,
    String dataType,
    Integer dataLength,
    Integer dataScale,
    String description
) {}
