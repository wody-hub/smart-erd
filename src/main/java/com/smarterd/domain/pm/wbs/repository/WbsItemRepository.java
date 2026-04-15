package com.smarterd.domain.pm.wbs.repository;

import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.project.entity.Project;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@link WbsItem} 데이터 접근 레포지토리.
 */
public interface WbsItemRepository extends JpaRepository<WbsItem, Long>, WbsItemRepositoryCustom {
    Optional<WbsItem> findByProjectAndId(Project project, Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update WbsItem w set w.milestone = null where w.milestone = :milestone")
    void clearMilestoneReferences(@Param("milestone") Milestone milestone);
}
