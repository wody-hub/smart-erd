package com.smarterd.domain.pm.issue.repository;

import static com.smarterd.domain.pm.issue.entity.QProjectIssue.projectIssue;

import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.dsl.CaseBuilder;
import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.pm.issue.entity.ProjectIssue;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.domain.pm.issue.service.ProjectIssueService.ProjectIssueQuery;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import lombok.RequiredArgsConstructor;

/**
 * {@link ProjectIssueRepositoryCustom} QueryDSL 구현체.
 */
@RequiredArgsConstructor
public class ProjectIssueRepositoryCustomImpl implements ProjectIssueRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    /**
     * 프로젝트 범위에서 필터 조건과 정렬 계약을 적용한 이슈 목록을 조회한다.
     *
     * @param project 프로젝트 엔티티
     * @param query 서버 소유 필터
     * @return 필터링/정렬된 프로젝트 이슈 목록
     */
    @Override
    public List<ProjectIssue> findByProjectAndQuery(Project project, ProjectIssueQuery query) {
        final var where = new BooleanBuilder(projectIssue.project.eq(project));

        if (!query.statuses().isEmpty()) {
            where.and(projectIssue.status.in(query.statuses()));
        }
        if (!query.priorities().isEmpty()) {
            where.and(projectIssue.priority.in(query.priorities()));
        }
        if (!query.assigneeIds().isEmpty() || query.includeUnassigned()) {
            final var assigneeFilter = new BooleanBuilder();
            if (!query.assigneeIds().isEmpty()) {
                assigneeFilter.or(projectIssue.assignee.id.in(query.assigneeIds()));
            }
            if (query.includeUnassigned()) {
                assigneeFilter.or(projectIssue.assignee.isNull());
            }
            where.and(assigneeFilter);
        }

        final var statusOrder = new CaseBuilder()
            .when(projectIssue.status.eq(ProjectIssueStatus.REGISTERED))
            .then(0)
            .when(projectIssue.status.eq(ProjectIssueStatus.IN_PROGRESS))
            .then(1)
            .otherwise(2);
        final var priorityOrder = new CaseBuilder()
            .when(projectIssue.priority.eq(ProjectIssuePriority.CRITICAL))
            .then(0)
            .when(projectIssue.priority.eq(ProjectIssuePriority.HIGH))
            .then(1)
            .when(projectIssue.priority.eq(ProjectIssuePriority.MEDIUM))
            .then(2)
            .otherwise(3);

        return queryFactory
            .selectFrom(projectIssue)
            .leftJoin(projectIssue.assignee)
            .fetchJoin()
            .where(where)
            .orderBy(
                statusOrder.asc(),
                priorityOrder.asc(),
                projectIssue.updatedAt.desc().nullsLast(),
                projectIssue.createdAt.desc().nullsLast(),
                projectIssue.id.desc()
            )
            .fetch();
    }
}
