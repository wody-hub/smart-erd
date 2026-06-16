package com.smarterd.domain.dictionary.service;

/**
 * 용어 벌크 저장 단계에서 사용하는 행 모델.
 *
 * @param logicalName 논리명
 * @param physicalName 물리명
 * @param domainLogicalName 도메인 논리명
 * @param description 설명
 */
record TermBulkRow(String logicalName, String physicalName, String domainLogicalName, String description) {}
