package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * 도메인 벌크 처리에서 기존 표준 도메인명 조회를 담당한다.
 */
final class DomainBulkExistingNameSupport {

    private static final int LOGICAL_NAME_QUERY_BATCH_SIZE = 5_000;

    private final DomainRepository domainRepository;

    /**
     * @param domainRepository 도메인 레포지토리
     */
    DomainBulkExistingNameSupport(DomainRepository domainRepository) {
        this.domainRepository = domainRepository;
    }

    /**
     * 원본 업로드 행에서 기존 표준 도메인명을 조회한다.
     *
     * @param dictionarySet 사전 세트
     * @param rawRows 원본 업로드 행
     * @param logicalNameResolver 표준 도메인명 해석 함수
     * @return 기존 표준 도메인명 집합
     */
    Set<String> findExistingNames(
        DictionarySet dictionarySet,
        List<Map<String, String>> rawRows,
        Function<Map<String, String>, String> logicalNameResolver
    ) {
        return findExistingNameValues(dictionarySet, rawRows.stream().map(logicalNameResolver).toList());
    }

    /**
     * 저장 후보 행에서 기존 표준 도메인명을 조회한다.
     *
     * @param dictionarySet 사전 세트
     * @param candidateRows 저장 후보 행
     * @return 기존 표준 도메인명 집합
     */
    Set<String> findExistingNames(DictionarySet dictionarySet, List<DomainBulkRow> candidateRows) {
        return findExistingNameValues(dictionarySet, candidateRows.stream().map(DomainBulkRow::logicalName).toList());
    }

    /**
     * 표준 도메인명 목록으로 기존 표준 도메인명을 조회한다.
     *
     * @param dictionarySet 사전 세트
     * @param logicalNames 표준 도메인명 목록
     * @return 기존 표준 도메인명 집합
     */
    private Set<String> findExistingNameValues(DictionarySet dictionarySet, List<String> logicalNames) {
        return BulkLogicalNameLookupSupport.findExistingByLogicalNames(
            logicalNames,
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> domainRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Domain::getLogicalName
        ).keySet();
    }
}
