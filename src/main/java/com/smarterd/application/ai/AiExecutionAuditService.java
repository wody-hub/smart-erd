package com.smarterd.application.ai;

import com.smarterd.domain.ai.AiExecutionAudit;
import com.smarterd.domain.ai.AiExecutionAuditRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Persists metadata-only AI execution audit rows.
 */
@Service
@RequiredArgsConstructor
public class AiExecutionAuditService {

    private final AiExecutionAuditRepository auditRepository;

    public void record(AiExecutionRegistry.ExecutionSnapshot execution) {
        final var error = execution.result() == null ? null : execution.result().error();
        final var audit = new AiExecutionAudit(
            execution.executionId(),
            execution.provider(),
            execution.promptVersion(),
            execution.state().name(),
            null,
            error == null ? null : error.type(),
            execution.durationMs(),
            execution.requestedBy(),
            execution.teamId(),
            execution.projectId(),
            error == null ? null : error.title(),
            error == null ? null : error.detail()
        );
        audit.initializeAuditActor(execution.requestedBy());
        auditRepository.save(audit);
    }
}
