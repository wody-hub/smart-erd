package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.team.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void migrateLegacyDictionaryScope() {
        final var teams = teamRepository.findAll();
        for (final var team : teams) {
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
}

