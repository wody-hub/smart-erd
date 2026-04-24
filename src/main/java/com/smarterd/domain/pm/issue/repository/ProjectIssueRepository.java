package com.smarterd.domain.pm.issue.repository;

import com.smarterd.domain.pm.issue.entity.ProjectIssue;
import com.smarterd.domain.project.entity.Project;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link ProjectIssue} 데이터 접근 레포지토리.
 */
public interface ProjectIssueRepository extends JpaRepository<ProjectIssue, Long>, ProjectIssueRepositoryCustom {
    /**
     * 프로젝트 범위에서 이슈를 담당자와 함께 조회한다.
     *
     * @param project 프로젝트 엔티티
     * @param id 이슈 ID
     * @return 프로젝트 이슈
     */
    @EntityGraph(attributePaths = { "assignee" })
    Optional<ProjectIssue> findByProjectAndId(Project project, Long id);
}
