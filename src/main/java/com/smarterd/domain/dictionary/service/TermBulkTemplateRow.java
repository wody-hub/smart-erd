package com.smarterd.domain.dictionary.service;

/**
 * 용어 벌크 템플릿 엑셀 생성용 행 데이터.
 *
 * @param logicalName 논리명
 * @param physicalName 물리명
 * @param domainLogicalName 도메인 논리명
 * @param description 설명
 */
public record TermBulkTemplateRow(
    String logicalName,
    String physicalName,
    String domainLogicalName,
    String description
) {}
