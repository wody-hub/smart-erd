package com.smarterd.application.ai;

import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory AI execution registry with retention and terminal-state discipline.
 */
public class AiExecutionRegistry {

    private final Duration retention;
    private final Clock clock;
    private final Map<String, MutableExecution> executions = new ConcurrentHashMap<>();

    public AiExecutionRegistry(Duration retention, Clock clock) {
        this.retention = retention;
        this.clock = clock;
    }

    public ExecutionSnapshot create(String requestedBy, Long teamId, Long projectId, String provider, String promptVersion) {
        final var now = clock.instant();
        final var execution = new MutableExecution(
            UUID.randomUUID().toString(),
            requestedBy,
            teamId,
            projectId,
            provider,
            promptVersion,
            now
        );
        executions.put(execution.executionId, execution);
        return execution.snapshot();
    }

    public ExecutionSnapshot get(String executionId, String requestedBy) {
        return visibleExecution(executionId, requestedBy).snapshot();
    }

    public void registerCancelHandler(String executionId, Runnable cancelHandler) {
        final var execution = executionOrNotFound(executionId);
        synchronized (execution) {
            execution.cancelHandler = cancelHandler;
        }
    }

    public boolean markRunning(String executionId) {
        final var execution = executionOrNotFound(executionId);
        synchronized (execution) {
            if (execution.state.terminal()) {
                return false;
            }
            execution.state = AiExecutionState.RUNNING;
            execution.startedAt = clock.instant();
            return true;
        }
    }

    public boolean markSucceeded(String executionId, AiProviderResult result) {
        return markTerminal(executionId, AiExecutionState.SUCCEEDED, result);
    }

    public boolean markFailed(String executionId, AiProviderResult result) {
        return markTerminal(executionId, AiExecutionState.FAILED, result);
    }

    public boolean markTimedOut(String executionId, AiProviderResult result) {
        return markTerminal(executionId, AiExecutionState.TIMED_OUT, result);
    }

    public boolean markCancelled(String executionId) {
        return markTerminal(executionId, AiExecutionState.CANCELLED, null);
    }

    public ExecutionSnapshot cancel(String executionId, String requestedBy) {
        final var execution = visibleExecution(executionId, requestedBy);
        Runnable cancelHandler = null;
        synchronized (execution) {
            if (!execution.state.terminal()) {
                execution.state = AiExecutionState.CANCELLED;
                execution.completedAt = clock.instant();
                cancelHandler = execution.cancelHandler;
            }
        }
        if (cancelHandler != null) {
            cancelHandler.run();
        }
        return execution.snapshot();
    }

    private boolean markTerminal(String executionId, AiExecutionState state, AiProviderResult result) {
        final var execution = executionOrNotFound(executionId);
        synchronized (execution) {
            if (execution.state.terminal()) {
                return false;
            }
            execution.state = state;
            execution.result = result;
            execution.completedAt = clock.instant();
            return true;
        }
    }

    private MutableExecution visibleExecution(String executionId, String requestedBy) {
        final var execution = executionOrNotFound(executionId);
        if (execution.isExpired(clock.instant(), retention)) {
            executions.remove(executionId);
            throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_AI_EXECUTION.code(), executionId);
        }
        if (!execution.requestedBy.equals(requestedBy)) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code());
        }
        return execution;
    }

    private MutableExecution executionOrNotFound(String executionId) {
        final var execution = executions.get(executionId);
        if (execution == null) {
            throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_AI_EXECUTION.code(), executionId);
        }
        return execution;
    }

    public record ExecutionSnapshot(
        String executionId,
        String requestedBy,
        Long teamId,
        Long projectId,
        String provider,
        String promptVersion,
        AiExecutionState state,
        Instant createdAt,
        Instant startedAt,
        Instant completedAt,
        AiProviderResult result,
        Long durationMs
    ) {}

    private final class MutableExecution {

        private final String executionId;
        private final String requestedBy;
        private final Long teamId;
        private final Long projectId;
        private final String provider;
        private final String promptVersion;
        private final Instant createdAt;
        private AiExecutionState state = AiExecutionState.QUEUED;
        private Instant startedAt;
        private Instant completedAt;
        private AiProviderResult result;
        private Runnable cancelHandler;

        private MutableExecution(
            String executionId,
            String requestedBy,
            Long teamId,
            Long projectId,
            String provider,
            String promptVersion,
            Instant createdAt
        ) {
            this.executionId = executionId;
            this.requestedBy = requestedBy;
            this.teamId = teamId;
            this.projectId = projectId;
            this.provider = provider;
            this.promptVersion = promptVersion;
            this.createdAt = createdAt;
        }

        private synchronized ExecutionSnapshot snapshot() {
            return new ExecutionSnapshot(
                executionId,
                requestedBy,
                teamId,
                projectId,
                provider,
                promptVersion,
                state,
                createdAt,
                startedAt,
                completedAt,
                result,
                durationMs()
            );
        }

        private boolean isExpired(Instant now, Duration retention) {
            return state.terminal() && completedAt != null && !completedAt.plus(retention).isAfter(now);
        }

        private Long durationMs() {
            if (startedAt == null || completedAt == null) {
                return null;
            }
            return Duration.between(startedAt, completedAt).toMillis();
        }
    }
}
