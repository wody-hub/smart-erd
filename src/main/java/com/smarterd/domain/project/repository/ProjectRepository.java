package com.smarterd.domain.project.repository;

import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link Project} 엔티티의 데이터 접근 레포지토리.
 */
public interface ProjectRepository extends JpaRepository<Project, Long> {
    /**
     * 특정 팀의 프로젝트 목록을 조회한다.
     *
     * @param team 팀
     * @return 프로젝트 목록
     */
    List<Project> findByTeam(Team team);
}
