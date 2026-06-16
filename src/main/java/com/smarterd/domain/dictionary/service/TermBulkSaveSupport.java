package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.dictionary.service.BulkModels.BulkSaveResult;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.utils.AppStringUtils;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * 검증을 통과한 용어 벌크 행을 엔티티로 변환하고 저장한다.
 */
final class TermBulkSaveSupport {

    private static final int LOGICAL_NAME_QUERY_BATCH_SIZE = 5_000;

    private final TermRepository termRepository;
    private final DomainRepository domainRepository;

    /**
     * @param termRepository 용어 레포지토리
     * @param domainRepository 도메인 레포지토리
     */
    TermBulkSaveSupport(TermRepository termRepository, DomainRepository domainRepository) {
        this.termRepository = termRepository;
        this.domainRepository = domainRepository;
    }

    /**
     * 검증 통과 후보 행을 저장한다.
     *
     * @param team 팀
     * @param dictionarySet 사전 세트
     * @param candidateRows 저장 후보 행
     * @return 저장 결과
     */
    BulkSaveResult saveAll(Team team, DictionarySet dictionarySet, List<TermBulkRow> candidateRows) {
        final var domainMap = findDomainsByLogicalName(dictionarySet);
        final var existingTermsByLogicalName = findExistingTermsByLogicalName(
            dictionarySet,
            candidateRows.stream().map(TermBulkRow::logicalName).toList()
        );
        final var termsToSave = new ArrayList<Term>();

        for (final var row : candidateRows) {
            termsToSave.add(toTerm(team, dictionarySet, row, domainMap, existingTermsByLogicalName));
        }

        try {
            termRepository.saveAll(termsToSave);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateException(MessageCode.ERROR_BULK_CONCURRENT_DUPLICATE.code());
        }
        return new BulkSaveResult(termsToSave.size(), 0);
    }

    /**
     * 사전 세트에 속한 도메인을 논리명 기준으로 반환한다.
     *
     * @param dictionarySet 사전 세트
     * @return 도메인 논리명 맵
     */
    private Map<String, Domain> findDomainsByLogicalName(DictionarySet dictionarySet) {
        return domainRepository
            .findByDictionarySet(dictionarySet)
            .stream()
            .collect(Collectors.toMap(Domain::getLogicalName, Function.identity()));
    }

    /**
     * 저장 후보 행을 용어 엔티티로 변환한다.
     *
     * @param team 팀
     * @param dictionarySet 사전 세트
     * @param row 저장 후보 행
     * @param domainMap 도메인 논리명 맵
     * @param existingTermsByLogicalName 기존 용어 맵
     * @return 저장할 용어 엔티티
     */
    private Term toTerm(
        Team team,
        DictionarySet dictionarySet,
        TermBulkRow row,
        Map<String, Domain> domainMap,
        Map<String, Term> existingTermsByLogicalName
    ) {
        final var domain = resolveDomain(row.domainLogicalName(), domainMap);
        final var existing = existingTermsByLogicalName.get(row.logicalName());
        if (existing != null) {
            existing.update(row.logicalName(), row.physicalName(), domain, row.description());
            return existing;
        }
        return Term.builder()
            .logicalName(row.logicalName())
            .physicalName(row.physicalName())
            .description(row.description())
            .team(team)
            .dictionarySet(dictionarySet)
            .domain(domain)
            .build();
    }

    /**
     * 선택 도메인 논리명에 해당하는 도메인을 반환한다.
     *
     * @param domainLogicalName 도메인 논리명
     * @param domainMap 도메인 논리명 맵
     * @return 도메인 엔티티 또는 null
     */
    private Domain resolveDomain(String domainLogicalName, Map<String, Domain> domainMap) {
        if (AppStringUtils.isBlank(domainLogicalName)) {
            return null;
        }
        return domainMap.get(domainLogicalName);
    }

    /**
     * 사전 세트 내 기존 용어를 논리명 기준으로 분할 조회한다.
     *
     * @param dictionarySet 사전 세트
     * @param logicalNames 조회 대상 논리명 목록
     * @return 논리명 기준 기존 용어 맵
     */
    private Map<String, Term> findExistingTermsByLogicalName(DictionarySet dictionarySet, List<String> logicalNames) {
        return BulkLogicalNameLookupSupport.findExistingByLogicalNames(
            logicalNames,
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> termRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Term::getLogicalName
        );
    }
}
