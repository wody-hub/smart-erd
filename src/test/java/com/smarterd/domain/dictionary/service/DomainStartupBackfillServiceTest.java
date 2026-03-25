package com.smarterd.domain.dictionary.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DictionarySetRepository;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DomainStartupBackfillServiceTest {

    @Mock
    private DomainRepository domainRepository;

    @Mock
    private DictionarySetRepository dictionarySetRepository;

    @Test
    void backfillMetadataIfNeeded_updatesGhContractDomainsFromLegacyData() {
        final var dictionarySet = createDictionarySet("GH 도급");
        final var legacyDomain = Domain.builder()
            .logicalName("적용 범위")
            .physicalType("VARCHAR(50)")
            .team(dictionarySet.getTeam())
            .dictionarySet(dictionarySet)
            .description("legacy")
            .build();

        when(domainRepository.findAll()).thenReturn(List.of(legacyDomain));
        when(dictionarySetRepository.findByNameOrderByIdAsc("GH 도급")).thenReturn(List.of(dictionarySet));
        when(domainRepository.findByDictionarySetOrderByIdAsc(dictionarySet)).thenReturn(List.of(legacyDomain));

        final var service = new DomainStartupBackfillService(domainRepository, dictionarySetRepository);
        final var summary = service.backfillMetadataIfNeeded();

        assertThat(summary.structuredTypeUpdates()).isEqualTo(1);
        assertThat(summary.ghContractUpdates()).isEqualTo(1);
        assertThat(legacyDomain.getDataType()).isEqualTo("VARCHAR");
        assertThat(legacyDomain.getDataLength()).isEqualTo(50);
        assertThat(legacyDomain.getDataScale()).isNull();
        assertThat(legacyDomain.getDomainGroup()).isEqualTo("명칭");
        assertThat(legacyDomain.getDomainClassification()).isEqualTo("적용 범위");
        assertThat(legacyDomain.getLogicalName()).isEqualTo("적용범위_V50");
        assertThat(legacyDomain.getPhysicalType()).isEqualTo("VARCHAR(50)");
    }

    @Test
    void backfillMetadataIfNeeded_keepsAlreadyNormalizedDomainsUntouched() {
        final var dictionarySet = createDictionarySet("GH 도급");
        final var normalizedDomain = Domain.builder()
            .logicalName("명_V200")
            .domainGroup("명칭")
            .domainClassification("명")
            .dataType("VARCHAR")
            .dataLength(200)
            .physicalType("VARCHAR(200)")
            .team(dictionarySet.getTeam())
            .dictionarySet(dictionarySet)
            .description("normalized")
            .build();

        when(domainRepository.findAll()).thenReturn(List.of(normalizedDomain));
        when(dictionarySetRepository.findByNameOrderByIdAsc("GH 도급")).thenReturn(List.of(dictionarySet));
        when(domainRepository.findByDictionarySetOrderByIdAsc(dictionarySet)).thenReturn(List.of(normalizedDomain));

        final var service = new DomainStartupBackfillService(domainRepository, dictionarySetRepository);
        final var summary = service.backfillMetadataIfNeeded();

        assertThat(summary.structuredTypeUpdates()).isZero();
        assertThat(summary.ghContractUpdates()).isZero();
        assertThat(normalizedDomain.getLogicalName()).isEqualTo("명_V200");
        assertThat(normalizedDomain.getDomainClassification()).isEqualTo("명");
    }

    private DictionarySet createDictionarySet(String name) {
        final var owner = User.builder()
            .loginId("riskzero")
            .password("hashed")
            .name("Risk Zero")
            .build();
        final var team = Team.builder()
            .name("core-team")
            .owner(owner)
            .build();
        return DictionarySet.builder()
            .name(name)
            .team(team)
            .isDefault(false)
            .build();
    }
}
