package com.smarterd.domain.pm.staffing.repository;

import com.smarterd.domain.pm.staffing.entity.ProjectStaffing;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.user.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link ProjectStaffing} 데이터 접근 레포지토리.
 */
public interface ProjectStaffingRepository extends JpaRepository<ProjectStaffing, Long> {
    @EntityGraph(attributePaths = { "user" })
    List<ProjectStaffing> findByProject(Project project);

    Optional<ProjectStaffing> findByProjectAndId(Project project, Long id);

    boolean existsByProjectAndUser(Project project, User user);
}
