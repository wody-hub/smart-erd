package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.team.repository.TeamRepository;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 기존 팀 단위 사전 데이터를 사전 세트로 백필한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DictionarySetMigrationService {

    private final TeamRepository teamRepository;
    private final DomainRepository domainRepository;
    private final TermRepository termRepository;
    private final DiagramRepository diagramRepository;
    private final DictionarySetService dictionarySetService;
    /** 팀 단위 트랜잭션 경계 제어용 트랜잭션 매니저 */
    private final PlatformTransactionManager transactionManager;

    /**
     * 애플리케이션 기동 후 레거시 팀 단위 사전 데이터를 세트 스코프로 백필한다.
     *
     * <p>팀별 독립 트랜잭션으로 처리하여 장시간 단일 트랜잭션 및 전체 롤백 리스크를 줄인다.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void migrateLegacyDictionaryScope() {
        final var teams = teamRepository.findAll();
        final var txTemplate = new TransactionTemplate(Objects.requireNonNull(transactionManager));
        for (final var team : teams) {
            txTemplate.executeWithoutResult((status) -> migrateSingleTeam(team.getId()));
        }
    }

    /**
     * 단일 팀의 레거시 사전 데이터 백필을 수행한다.
     *
     * @param teamId 대상 팀 ID
     */
    private void migrateSingleTeam(Long teamId) {
        final var team = teamRepository
            .findById(Objects.requireNonNull(teamId))
            .orElseThrow(() -> new IllegalStateException("Team not found: " + teamId));
        final var defaultSet = dictionarySetService.findOrCreateDefaultSet(team);
        final var updatedDomains = domainRepository.backfillNullDictionarySetByTeam(team, defaultSet);
        final var updatedTerms = termRepository.backfillNullDictionarySetByTeam(team, defaultSet);
        final var updatedDiagrams = diagramRepository.backfillNullDictionarySetByTeam(team, defaultSet);
        if (updatedDomains + updatedTerms + updatedDiagrams > 0) {
            log.info(
                "Dictionary set backfill completed: teamId={}, domains={}, terms={}, diagrams={}",
                team.getId(),
                updatedDomains,
                updatedTerms,
                updatedDiagrams
            );
        }
    }
}
