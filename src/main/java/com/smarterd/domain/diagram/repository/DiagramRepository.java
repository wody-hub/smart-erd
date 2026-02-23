package com.smarterd.domain.diagram.repository;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@link Diagram} 엔티티의 데이터 접근 레포지토리.
 */
public interface DiagramRepository extends JpaRepository<Diagram, Long>, DiagramRepositoryCustom {
    /**
     * 특정 프로젝트의 모든 다이어그램을 조회한다.
     *
     * @param project 프로젝트
     * @return 다이어그램 목록
     */
    @EntityGraph(attributePaths = { "dictionarySet" })
    List<Diagram> findByProject(Project project);

    /**
     * 특정 프로젝트에서 ID로 다이어그램을 조회한다.
     *
     * @param project 프로젝트
     * @param id      다이어그램 ID
     * @return 다이어그램 Optional
     */
    @EntityGraph(attributePaths = { "dictionarySet" })
    Optional<Diagram> findByProjectAndId(Project project, Long id);

    long countByDictionarySet(DictionarySet dictionarySet);

    @Modifying
    @Query("update Diagram d set d.dictionarySet = null where d.dictionarySet = :dictionarySet")
    int clearDictionarySetReferences(@Param("dictionarySet") DictionarySet dictionarySet);

    /**
     * 프로젝트 목록에 속한 다이어그램을 일괄 삭제한다.
     *
     * @param projects 프로젝트 목록
     */
    void deleteByProjectIn(List<Project> projects);

    @Modifying
    @Query(
        "update Diagram d set d.dictionarySet = :dictionarySet where d.project.team = :team and d.dictionarySet is null"
    )
    int backfillNullDictionarySetByTeam(@Param("team") Team team, @Param("dictionarySet") DictionarySet dictionarySet);
}
