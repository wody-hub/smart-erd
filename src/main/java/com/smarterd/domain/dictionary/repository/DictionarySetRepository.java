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
    /**
     * 팀의 사전 세트 목록을 생성일 오름차순으로 조회한다.
     *
     * @param team 팀 엔티티
     * @return 사전 세트 목록
     */
    List<DictionarySet> findByTeamOrderByCreatedAtAsc(Team team);

    /**
     * 팀 범위에서 ID로 사전 세트를 조회한다.
     *
     * @param team 팀 엔티티
     * @param id   사전 세트 ID
     * @return 사전 세트 Optional
     */
    Optional<DictionarySet> findByTeamAndId(Team team, Long id);

    /**
     * 이름이 동일한 사전 세트를 ID 오름차순으로 조회한다.
     *
     * @param name 사전 세트 이름
     * @return 사전 세트 목록
     */
    List<DictionarySet> findByNameOrderByIdAsc(String name);

    /**
     * 팀의 기본 사전 세트를 조회한다.
     *
     * @param team 팀 엔티티
     * @return 기본 사전 세트 Optional
     */
    Optional<DictionarySet> findFirstByTeamAndIsDefaultTrue(Team team);

    /**
     * 팀 내 동일한 이름의 사전 세트 존재 여부를 조회한다.
     *
     * @param team 팀 엔티티
     * @param name 사전 세트 이름
     * @return 존재 여부
     */
    boolean existsByTeamAndName(Team team, String name);

    /**
     * 팀 내 동일 이름의 사전 세트 존재 여부를 조회한다. (자기 자신 제외)
     *
     * @param team 팀 엔티티
     * @param name 사전 세트 이름
     * @param id   제외할 사전 세트 ID
     * @return 존재 여부
     */
    boolean existsByTeamAndNameAndIdNot(Team team, String name, Long id);

    /**
     * 팀의 사전 세트 개수를 조회한다.
     *
     * @param team 팀 엔티티
     * @return 사전 세트 개수
     */
    long countByTeam(Team team);

    /**
     * 팀의 사전 세트를 일괄 삭제한다.
     *
     * @param team 팀 엔티티
     */
    void deleteByTeam(Team team);
}
