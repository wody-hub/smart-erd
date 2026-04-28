package com.smarterd.domain.pm.history.repository;

import com.smarterd.domain.pm.history.entity.WorkActivity;
import com.smarterd.domain.pm.history.entity.WorkTargetType;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 공통 작업 활동 로그 레포지토리.
 */
public interface WorkActivityRepository extends JpaRepository<WorkActivity, Long> {
    List<WorkActivity> findByProjectAndTargetTypeAndTargetIdOrderByCreatedAtDescIdDesc(
        Project project,
        WorkTargetType targetType,
        Long targetId
    );
}
