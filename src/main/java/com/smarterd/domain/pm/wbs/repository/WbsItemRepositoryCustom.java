package com.smarterd.domain.pm.wbs.repository;

import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import java.util.Map;
import org.springframework.lang.Nullable;

/**
 * {@link WbsItem} QueryDSL 커스텀 레포지토리.
 */
public interface WbsItemRepositoryCustom {
    List<WbsItem> findByProjectWithRelations(Project project);

    int findNextSortOrder(Project project, @Nullable WbsItem parent);

    /**
     * 프로젝트의 WBS 평균 진척률을 계산한다.
     *
     * @param project 프로젝트 엔티티
     * @return 평균 진척률 (반올림), WBS 항목이 없으면 {@code null}
     */
    @Nullable
    Integer averageProgressRateByProject(Project project);

    /**
     * 마일스톤별 WBS 진척률 집계를 반환한다.
     *
     * @param project 프로젝트 엔티티
     * @return 마일스톤 ID → {@link MilestoneProgressAggregate} 맵
     */
    Map<Long, MilestoneProgressAggregate> aggregateProgressByMilestone(Project project);

    /**
     * 특정 마일스톤의 WBS 진척률 집계를 반환한다.
     *
     * @param milestone 마일스톤 엔티티
     * @return 진척률 집계
     */
    MilestoneProgressAggregate aggregateProgressByMilestone(Milestone milestone);

    /**
     * 마일스톤별 WBS 진척률 집계 결과.
     *
     * @param count          연결된 WBS 항목 수
     * @param completedCount 완료된 WBS 항목 수
     * @param averageRate    평균 진척률 (반올림), 항목이 없으면 0
     */
    record MilestoneProgressAggregate(long count, long completedCount, int averageRate) {
        /** 항목이 없는 경우의 기본 집계. */
        public static final MilestoneProgressAggregate EMPTY = new MilestoneProgressAggregate(0, 0, 0);
    }
}
