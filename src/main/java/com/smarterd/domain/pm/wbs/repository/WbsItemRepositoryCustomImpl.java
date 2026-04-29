package com.smarterd.domain.pm.wbs.repository;

import static com.smarterd.domain.pm.wbs.entity.QWbsItem.wbsItem;

import com.querydsl.core.types.dsl.CaseBuilder;
import com.querydsl.core.Tuple;
import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.project.entity.Project;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;

/**
 * {@link WbsItemRepositoryCustom} QueryDSL 구현체.
 */
@RequiredArgsConstructor
public class WbsItemRepositoryCustomImpl implements WbsItemRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<WbsItem> findByProjectWithRelations(Project project) {
        return queryFactory
            .selectFrom(wbsItem)
            .leftJoin(wbsItem.parent)
            .fetchJoin()
            .leftJoin(wbsItem.assignee)
            .fetchJoin()
            .leftJoin(wbsItem.milestone)
            .fetchJoin()
            .where(wbsItem.project.eq(project))
            .orderBy(wbsItem.sortOrder.asc(), wbsItem.id.asc())
            .fetch();
    }

    @Override
    public int findNextSortOrder(Project project, @Nullable WbsItem parent) {
        final var where =
            parent == null
                ? wbsItem.project.eq(project).and(wbsItem.parent.isNull())
                : wbsItem.project.eq(project).and(wbsItem.parent.eq(parent));
        final var maxSortOrder = queryFactory.select(wbsItem.sortOrder.max()).from(wbsItem).where(where).fetchOne();
        return maxSortOrder == null ? 0 : maxSortOrder + 1;
    }

    @Override
    public Integer averageProgressRateByProject(Project project) {
        final var averageProgress = queryFactory
            .select(wbsItem.progressRate.avg())
            .from(wbsItem)
            .where(wbsItem.project.eq(project))
            .fetchOne();
        return averageProgress == null ? null : (int) Math.round(averageProgress);
    }

    @Override
    public Map<Long, MilestoneProgressAggregate> aggregateProgressByMilestone(Project project) {
        final var completedCountExpression = new CaseBuilder().when(wbsItem.progressRate.goe(100)).then(1).otherwise(0).sum();
        final var results = queryFactory
            .select(wbsItem.milestone.id, wbsItem.count(), completedCountExpression, wbsItem.progressRate.avg())
            .from(wbsItem)
            .where(wbsItem.project.eq(project).and(wbsItem.milestone.isNotNull()))
            .groupBy(wbsItem.milestone.id)
            .fetch();

        final Map<Long, MilestoneProgressAggregate> aggregates = new HashMap<>();
        for (final Tuple row : results) {
            final var milestoneId = row.get(wbsItem.milestone.id);
            final var count = row.get(wbsItem.count());
            final var completedCount = row.get(completedCountExpression);
            final var avg = row.get(wbsItem.progressRate.avg());
            if (milestoneId != null && count != null) {
                aggregates.put(
                    milestoneId,
                    new MilestoneProgressAggregate(
                        count,
                        completedCount == null ? 0 : completedCount.longValue(),
                        avg == null ? 0 : (int) Math.round(avg)
                    )
                );
            }
        }
        return aggregates;
    }

    @Override
    public MilestoneProgressAggregate aggregateProgressByMilestone(Milestone milestone) {
        final var completedCountExpression = new CaseBuilder().when(wbsItem.progressRate.goe(100)).then(1).otherwise(0).sum();
        final var result = queryFactory
            .select(wbsItem.count(), completedCountExpression, wbsItem.progressRate.avg())
            .from(wbsItem)
            .where(wbsItem.milestone.eq(milestone))
            .fetchOne();

        if (result == null) {
            return MilestoneProgressAggregate.EMPTY;
        }
        final var count = result.get(wbsItem.count());
        final var completedCount = result.get(completedCountExpression);
        final var avg = result.get(wbsItem.progressRate.avg());
        if (count == null || count == 0L) {
            return MilestoneProgressAggregate.EMPTY;
        }
        return new MilestoneProgressAggregate(
            count,
            completedCount == null ? 0 : completedCount.longValue(),
            avg == null ? 0 : (int) Math.round(avg)
        );
    }
}
