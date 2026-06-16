package com.smarterd.domain.dictionary.service;

/**
 * 도메인 벌크 업로드 행의 정규화된 문자열 값.
 *
 * @param domainGroup 도메인 그룹
 * @param domainClassification 도메인 분류
 * @param logicalName 논리명
 * @param dataType 데이터 타입
 * @param dataLengthRaw 데이터 길이 원문
 * @param dataScaleRaw 데이터 소수점 길이 원문
 * @param description 설명
 */
record NormalizedDomainRow(
    String domainGroup,
    String domainClassification,
    String logicalName,
    String dataType,
    String dataLengthRaw,
    String dataScaleRaw,
    String description
) {}
