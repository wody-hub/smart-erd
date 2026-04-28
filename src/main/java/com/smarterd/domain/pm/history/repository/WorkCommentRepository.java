package com.smarterd.domain.pm.history.repository;

import com.smarterd.domain.pm.history.entity.WorkComment;
import com.smarterd.domain.pm.history.entity.WorkTargetType;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 공통 작업 댓글 레포지토리.
 */
public interface WorkCommentRepository extends JpaRepository<WorkComment, Long> {
    List<WorkComment> findByProjectAndTargetTypeAndTargetIdOrderByCreatedAtAscIdAsc(
        Project project,
        WorkTargetType targetType,
        Long targetId
    );
}
