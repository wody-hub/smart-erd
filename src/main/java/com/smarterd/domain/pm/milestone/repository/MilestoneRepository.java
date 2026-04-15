package com.smarterd.domain.pm.milestone.repository;

import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.project.entity.Project;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link Milestone} 데이터 접근 레포지토리.
 */
public interface MilestoneRepository extends JpaRepository<Milestone, Long>, MilestoneRepositoryCustom {
    Optional<Milestone> findByProjectAndId(Project project, Long id);
}
