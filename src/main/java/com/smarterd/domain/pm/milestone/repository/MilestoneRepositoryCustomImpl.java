package com.smarterd.domain.pm.milestone.repository;

import static com.smarterd.domain.pm.milestone.entity.QMilestone.milestone;

import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import lombok.RequiredArgsConstructor;

/**
 * {@link MilestoneRepositoryCustom} QueryDSL 구현체.
 */
@RequiredArgsConstructor
public class MilestoneRepositoryCustomImpl implements MilestoneRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<Milestone> findByProjectOrderBySortOrder(Project project) {
        return queryFactory
            .selectFrom(milestone)
            .where(milestone.project.eq(project))
            .orderBy(milestone.sortOrder.asc(), milestone.id.asc())
            .fetch();
    }

    @Override
    public int findNextSortOrder(Project project) {
        final var maxSortOrder = queryFactory
            .select(milestone.sortOrder.max())
            .from(milestone)
            .where(milestone.project.eq(project))
            .fetchOne();
        return maxSortOrder == null ? 0 : maxSortOrder + 1;
    }
}
