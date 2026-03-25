package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.team.entity.Team;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@link Term} 엔티티의 데이터 접근 레포지토리.
 */
public interface TermRepository extends JpaRepository<Term, Long>, TermRepositoryCustom {
    List<Term> findByDictionarySet(DictionarySet dictionarySet);

    @EntityGraph(attributePaths = "domain")
    List<Term> findByDictionarySetOrderByLogicalNameAscIdAsc(DictionarySet dictionarySet);

    @EntityGraph(attributePaths = "domain")
    Page<Term> findByDictionarySet(DictionarySet dictionarySet, Pageable pageable);

    @EntityGraph(attributePaths = "domain")
    @Query(
        """
        select t
        from Term t
        where t.dictionarySet = :dictionarySet
          and (
            lower(t.logicalName) like lower(concat('%', :keyword, '%'))
            or lower(t.physicalName) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(t.description, '')) like lower(concat('%', :keyword, '%'))
          )
        """
    )
    Page<Term> searchByDictionarySet(
        @Param("dictionarySet") DictionarySet dictionarySet,
        @Param("keyword") String keyword,
        Pageable pageable
    );

    boolean existsByDictionarySetAndLogicalName(DictionarySet dictionarySet, String logicalName);

    boolean existsByDictionarySetAndLogicalNameAndIdNot(DictionarySet dictionarySet, String logicalName, Long id);

    List<Term> findByDictionarySetAndLogicalNameIn(DictionarySet dictionarySet, Collection<String> logicalNames);

    Optional<Term> findByDictionarySetAndLogicalName(DictionarySet dictionarySet, String logicalName);

    Optional<Term> findFirstByDictionarySetAndLogicalNameContaining(DictionarySet dictionarySet, String keyword);

    long countByDictionarySet(DictionarySet dictionarySet);

    /**
     * 팀에 속한 모든 용어를 조회한다.
     *
     * @param team 팀 엔티티
     * @return 용어 목록
     */
    List<Term> findByTeam(Team team);

    /**
     * 팀 내에 동일한 논리명의 용어가 존재하는지 확인한다.
     *
     * @param team        팀 엔티티
     * @param logicalName 논리명
     * @return 존재 여부
     */
    boolean existsByTeamAndLogicalName(Team team, String logicalName);

    /**
     * 팀 내에 동일한 논리명의 용어가 존재하는지 확인한다 (자기 자신 제외).
     *
     * @param team        팀 엔티티
     * @param logicalName 논리명
     * @param id          제외할 용어 ID
     * @return 존재 여부
     */
    boolean existsByTeamAndLogicalNameAndIdNot(Team team, String logicalName, Long id);

    /**
     * 특정 도메인을 참조하는 용어 수를 반환한다.
     *
     * @param domain 도메인 엔티티
     * @return 참조 중인 용어 수
     */
    long countByDomain(Domain domain);

    /**
     * 팀 내 논리명 목록으로 용어를 일괄 조회한다 (bulk 검증용).
     *
     * @param team         팀 엔티티
     * @param logicalNames 논리명 목록
     * @return 매칭된 용어 목록
     */
    List<Term> findByTeamAndLogicalNameIn(Team team, Collection<String> logicalNames);

    /**
     * 팀 내 논리명으로 단일 용어를 조회한다.
     *
     * @param team        팀 엔티티
     * @param logicalName 논리명
     * @return 용어 (Optional)
     */
    Optional<Term> findByTeamAndLogicalName(Team team, String logicalName);

    /**
     * 팀 내 논리명에 키워드를 포함하는 첫 번째 용어를 조회한다.
     *
     * @param team    팀 엔티티
     * @param keyword 검색 키워드
     * @return 매칭된 용어 (Optional)
     */
    Optional<Term> findFirstByTeamAndLogicalNameContaining(Team team, String keyword);

    /**
     * 특정 팀의 용어를 일괄 삭제한다.
     *
     * @param team 팀 엔티티
     */
    void deleteByTeam(Team team);

    void deleteByDictionarySet(DictionarySet dictionarySet);

    @Modifying
    @Query("update Term t set t.dictionarySet = :dictionarySet where t.team = :team and t.dictionarySet is null")
    int backfillNullDictionarySetByTeam(@Param("team") Team team, @Param("dictionarySet") DictionarySet dictionarySet);
}
