package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.team.entity.Team;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@link Domain} 엔티티의 데이터 접근 레포지토리.
 */
public interface DomainRepository extends JpaRepository<Domain, Long> {
    List<Domain> findByDictionarySet(DictionarySet dictionarySet);

    Page<Domain> findByDictionarySet(DictionarySet dictionarySet, Pageable pageable);

    @Query(
        """
        select d
        from Domain d
        where d.dictionarySet = :dictionarySet
          and (
            lower(d.logicalName) like lower(concat('%', :keyword, '%'))
            or lower(d.physicalType) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(d.description, '')) like lower(concat('%', :keyword, '%'))
          )
        """
    )
    Page<Domain> searchByDictionarySet(
        @Param("dictionarySet") DictionarySet dictionarySet,
        @Param("keyword") String keyword,
        Pageable pageable
    );

    boolean existsByDictionarySetAndLogicalName(DictionarySet dictionarySet, String logicalName);

    boolean existsByDictionarySetAndLogicalNameAndIdNot(DictionarySet dictionarySet, String logicalName, Long id);

    List<Domain> findByDictionarySetAndLogicalNameIn(DictionarySet dictionarySet, Collection<String> logicalNames);

    Optional<Domain> findByDictionarySetAndLogicalName(DictionarySet dictionarySet, String logicalName);

    /**
     * 팀에 속한 모든 도메인을 조회한다.
     *
     * @param team 팀 엔티티
     * @return 도메인 목록
     */
    List<Domain> findByTeam(Team team);

    /**
     * 팀 내에 동일한 논리명의 도메인이 존재하는지 확인한다.
     *
     * @param team        팀 엔티티
     * @param logicalName 논리명
     * @return 존재 여부
     */
    boolean existsByTeamAndLogicalName(Team team, String logicalName);

    /**
     * 팀 내에 동일한 논리명의 도메인이 존재하는지 확인한다 (자기 자신 제외).
     *
     * @param team        팀 엔티티
     * @param logicalName 논리명
     * @param id          제외할 도메인 ID
     * @return 존재 여부
     */
    boolean existsByTeamAndLogicalNameAndIdNot(Team team, String logicalName, Long id);

    /**
     * 팀 내 논리명 목록으로 도메인을 일괄 조회한다 (bulk 검증용).
     *
     * @param team         팀 엔티티
     * @param logicalNames 논리명 목록
     * @return 매칭된 도메인 목록
     */
    List<Domain> findByTeamAndLogicalNameIn(Team team, Collection<String> logicalNames);

    /**
     * 팀 내 논리명으로 단일 도메인을 조회한다.
     *
     * @param team        팀 엔티티
     * @param logicalName 논리명
     * @return 도메인 (Optional)
     */
    Optional<Domain> findByTeamAndLogicalName(Team team, String logicalName);

    /**
     * 특정 팀의 도메인을 일괄 삭제한다.
     *
     * @param team 팀 엔티티
     */
    void deleteByTeam(Team team);

    void deleteByDictionarySet(DictionarySet dictionarySet);

    @Modifying
    @Query("update Domain d set d.dictionarySet = :dictionarySet where d.team = :team and d.dictionarySet is null")
    int backfillNullDictionarySetByTeam(@Param("team") Team team, @Param("dictionarySet") DictionarySet dictionarySet);
}
