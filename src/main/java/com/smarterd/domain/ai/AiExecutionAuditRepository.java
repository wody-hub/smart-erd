package com.smarterd.domain.ai;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * AI execution audit repository.
 */
public interface AiExecutionAuditRepository extends JpaRepository<AiExecutionAudit, Long> {
    List<AiExecutionAudit> findByTeamIdAndProjectId(Long teamId, Long projectId, Pageable pageable);
}
