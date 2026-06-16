package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.service.BulkModels.BulkSaveResult;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.utils.AppStringUtils;
import java.util.ArrayList;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * 검증을 통과한 도메인 벌크 행을 엔티티로 변환하고 저장한다.
 */
final class DomainBulkSaveSupport {

    private final DomainRepository domainRepository;
    private final DomainBulkExistingNameSupport existingNameSupport;

    /**
     * @param domainRepository 도메인 레포지토리
     */
    DomainBulkSaveSupport(DomainRepository domainRepository, DomainBulkExistingNameSupport existingNameSupport) {
        this.domainRepository = domainRepository;
        this.existingNameSupport = existingNameSupport;
    }

    /**
     * 검증 통과 후보 행을 저장한다.
     *
     * @param team 팀
     * @param dictionarySet 사전 세트
     * @param candidateRows 저장 후보 행
     * @return 저장 결과
     */
    BulkSaveResult saveAll(Team team, DictionarySet dictionarySet, List<DomainBulkRow> candidateRows) {
        final var existingNames = existingNameSupport.findExistingNames(dictionarySet, candidateRows);
        final var domainsToSave = new ArrayList<Domain>();
        var failedCount = 0;

        for (final var row : candidateRows) {
            if (existingNames.contains(row.logicalName())) {
                failedCount++;
                continue;
            }
            domainsToSave.add(toDomain(team, dictionarySet, row));
        }

        try {
            domainRepository.saveAll(domainsToSave);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateException(MessageCode.ERROR_BULK_CONCURRENT_DUPLICATE.code());
        }
        return new BulkSaveResult(domainsToSave.size(), failedCount);
    }

    /**
     * 저장 후보 행을 도메인 엔티티로 변환한다.
     *
     * @param team 팀
     * @param dictionarySet 사전 세트
     * @param row 저장 후보 행
     * @return 도메인 엔티티
     */
    private Domain toDomain(Team team, DictionarySet dictionarySet, DomainBulkRow row) {
        final var typeComponents = DomainPhysicalTypeSupport.fromStructured(
            row.dataType(),
            row.dataLength(),
            row.dataScale()
        );
        return Domain.builder()
            .logicalName(row.logicalName())
            .domainGroup(AppStringUtils.trimToNull(row.domainGroup()))
            .domainClassification(AppStringUtils.trimToNull(row.domainClassification()))
            .dataType(typeComponents.dataType())
            .dataLength(typeComponents.dataLength())
            .dataScale(typeComponents.dataScale())
            .physicalType(typeComponents.physicalType())
            .description(row.description())
            .team(team)
            .dictionarySet(dictionarySet)
            .build();
    }
}
