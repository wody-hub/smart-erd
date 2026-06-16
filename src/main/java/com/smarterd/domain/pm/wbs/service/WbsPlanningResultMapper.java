package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.pm.wbs.entity.WbsDependency;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.entity.WbsTemplate;
import java.util.List;

/**
 * WBS planning 도메인 결과를 API 응답용 result record로 변환한다.
 */
final class WbsPlanningResultMapper {

    private final WbsScheduleMetricsService wbsScheduleMetricsService;

    /**
     * @param wbsScheduleMetricsService WBS 일정 지표 서비스
     */
    WbsPlanningResultMapper(WbsScheduleMetricsService wbsScheduleMetricsService) {
        this.wbsScheduleMetricsService = wbsScheduleMetricsService;
    }

    /**
     * template 엔티티를 요약 결과로 변환한다.
     *
     * @param template WBS template
     * @return WBS template 요약 결과
     */
    WbsPlanningService.WbsTemplateSummaryResult toTemplateSummary(WbsTemplate template) {
        return new WbsPlanningService.WbsTemplateSummaryResult(
            template.getId(),
            template.getName(),
            template.getDescription(),
            template.getRootName(),
            template.getItemCount(),
            template.getDependencyCount(),
            template.getCreatedAt(),
            template.getUpdatedAt()
        );
    }

    /**
     * dependency 엔티티를 결과로 변환한다.
     *
     * @param dependency WBS dependency
     * @return WBS dependency 결과
     */
    WbsDependencyService.WbsDependencyResult toDependencyResult(WbsDependency dependency) {
        return new WbsDependencyService.WbsDependencyResult(
            dependency.getId(),
            dependency.getPredecessor().getId(),
            dependency.getPredecessor().getName(),
            dependency.getSuccessor().getId(),
            dependency.getSuccessor().getName(),
            dependency.getDependencyType(),
            dependency.getSortOrder(),
            dependency.getCreatedAt(),
            dependency.getUpdatedAt()
        );
    }

    /**
     * WBS item 엔티티를 결과로 변환한다.
     *
     * @param item WBS item
     * @return WBS item 결과
     */
    WbsService.WbsItemResult toItemResult(WbsItem item) {
        return toItemResult(item, List.of(), List.of());
    }

    /**
     * WBS item 엔티티와 dependency id 목록을 결과로 변환한다.
     *
     * @param item WBS item
     * @param predecessorIds 선행 WBS ID 목록
     * @param successorIds 후행 WBS ID 목록
     * @return WBS item 결과
     */
    WbsService.WbsItemResult toItemResult(WbsItem item, List<Long> predecessorIds, List<Long> successorIds) {
        final var assignee = item.getAssignee();
        final var milestone = item.getMilestone();
        final var scheduleMetrics = wbsScheduleMetricsService.calculate(
            item.getStartDate(),
            item.getEndDate(),
            item.getActualStartDate(),
            item.getActualEndDate(),
            item.getProgressRate()
        );
        return new WbsService.WbsItemResult(
            item.getId(),
            item.getParent() == null ? null : item.getParent().getId(),
            item.getName(),
            item.getDepth(),
            item.getSortOrder(),
            assignee == null ? null : assignee.getId(),
            assignee == null ? null : assignee.getName(),
            item.getStartDate(),
            item.getEndDate(),
            item.getActualStartDate(),
            item.getActualEndDate(),
            item.getProgressRate(),
            scheduleMetrics.plannedProgressRate(),
            scheduleMetrics.progressVarianceRate(),
            scheduleMetrics.startVarianceDays(),
            scheduleMetrics.endVarianceDays(),
            item.getEstimatedMm(),
            milestone == null ? null : milestone.getId(),
            milestone == null ? null : milestone.getName(),
            List.copyOf(predecessorIds),
            List.copyOf(successorIds),
            item.getCreatedAt(),
            item.getUpdatedAt()
        );
    }
}
