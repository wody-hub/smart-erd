package com.smarterd.domain.diagram.service;

/**
 * 다이어그램 사전 세트 변경 결과.
 *
 * @param dictionarySetId              변경된 사전 세트 ID
 * @param invalidatedTermBindingCount  무효화된 term 바인딩 수
 * @param invalidatedDomainBindingCount 무효화된 domain 바인딩 수
 */
public record DictionarySetChangeResult(
    Long dictionarySetId,
    int invalidatedTermBindingCount,
    int invalidatedDomainBindingCount
) {}
