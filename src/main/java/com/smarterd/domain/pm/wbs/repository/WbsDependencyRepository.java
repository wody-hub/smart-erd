package com.smarterd.domain.pm.wbs.repository;

import com.smarterd.domain.pm.wbs.entity.WbsDependency;
import com.smarterd.domain.pm.wbs.entity.WbsDependencyType;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@link WbsDependency} 데이터 접근 레포지토리.
 */
public interface WbsDependencyRepository extends JpaRepository<WbsDependency, Long> {
    @Query(
        """
        select d
        from WbsDependency d
        join fetch d.predecessor
        left join fetch d.predecessor.milestone
        join fetch d.successor
        left join fetch d.successor.milestone
        where d.project = :project
        order by d.sortOrder asc, d.id asc
        """
    )
    List<WbsDependency> findByProjectWithRelations(@Param("project") Project project);

    Optional<WbsDependency> findByProjectAndId(Project project, Long id);

    boolean existsByProjectAndPredecessorAndSuccessorAndDependencyType(
        Project project,
        WbsItem predecessor,
        WbsItem successor,
        WbsDependencyType dependencyType
    );

    @Query("select coalesce(max(d.sortOrder), -1) + 1 from WbsDependency d where d.project = :project")
    int findNextSortOrder(@Param("project") Project project);
}
