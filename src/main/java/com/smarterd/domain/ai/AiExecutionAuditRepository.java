package com.smarterd.domain.ai;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * AI execution audit repository.
 */
public interface AiExecutionAuditRepository extends JpaRepository<AiExecutionAudit, Long> {}
