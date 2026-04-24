package com.smarterd.domain.pm.issue.repository;

import com.smarterd.domain.pm.issue.entity.ProjectIssue;
import com.smarterd.domain.pm.issue.service.ProjectIssueService.ProjectIssueQuery;
import com.smarterd.domain.project.entity.Project;
import java.util.List;

/**
 * {@link ProjectIssue} QueryDSL 커스텀 레포지토리.
 */
public interface ProjectIssueRepositoryCustom {
    /**
     * 프로젝트 이슈를 현재 필터/정렬 계약에 맞춰 조회한다.
     *
     * @param project 프로젝트 엔티티
     * @param query 서버 소유 필터
     * @return 필터링된 이슈 목록
     */
    List<ProjectIssue> findByProjectAndQuery(Project project, ProjectIssueQuery query);
}
