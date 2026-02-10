package com.smarterd.domain.diagram.repository;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

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
    List<Diagram> findByProject(Project project);

    /**
     * 특정 프로젝트에서 ID로 다이어그램을 조회한다.
     *
     * @param project 프로젝트
     * @param id      다이어그램 ID
     * @return 다이어그램 Optional
     */
    Optional<Diagram> findByProjectAndId(Project project, Long id);
}
