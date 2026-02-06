package com.smarterd.domain.project.repository;

import com.smarterd.domain.project.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link Project} 엔티티의 데이터 접근 레포지토리.
 */
public interface ProjectRepository extends JpaRepository<Project, Long> {
}
