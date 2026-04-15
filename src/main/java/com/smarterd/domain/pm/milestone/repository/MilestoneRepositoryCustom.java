package com.smarterd.domain.pm.milestone.repository;

import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.project.entity.Project;
import java.util.List;

/**
 * {@link Milestone} QueryDSL 커스텀 레포지토리.
 */
public interface MilestoneRepositoryCustom {
    List<Milestone> findByProjectOrderBySortOrder(Project project);

    int findNextSortOrder(Project project);
}
