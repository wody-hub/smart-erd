package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.team.entity.Team;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link DictionarySet} 데이터 접근 레포지토리.
 */
public interface DictionarySetRepository extends JpaRepository<DictionarySet, Long> {
    List<DictionarySet> findByTeamOrderByCreatedAtAsc(Team team);

    Optional<DictionarySet> findByTeamAndId(Team team, Long id);

    Optional<DictionarySet> findFirstByTeamAndIsDefaultTrue(Team team);

    boolean existsByTeamAndName(Team team, String name);

    boolean existsByTeamAndNameAndIdNot(Team team, String name, Long id);

    long countByTeam(Team team);

    void deleteByTeam(Team team);
}

