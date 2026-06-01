package com.smarterd.application.ai;

import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.application.ai.provider.AiProviderRequest;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Provider-independent AI execution gateway.
 */
@Service
@RequiredArgsConstructor
public class AiExecutionGateway {

    public static final String PROMPT_VERSION = "provider-response-v1";

    private final ProjectContextLoader projectContextLoader;
    private final SelectedResourceValidator selectedResourceValidator;
    private final AiExecutionAuditService auditService;
    private final AiProvider aiProvider;
    private final AiExecutionRegistry executionRegistry;
    private final ProviderOutputValidator outputValidator;

    public AiProviderStatusView status() {
        final var status = aiProvider.status();
        return new AiProviderStatusView(
            status.provider(),
            status.availability().name(),
            status.message(),
            status.checkedAt()
        );
    }

    @Transactional
    public AiExecutionView execute(String loginId, ExecuteCommand command) {
        final var context = projectContextLoader.load(loginId, command.teamId(), command.projectId(), false);
        selectedResourceValidator.validate(loginId, context.project(), command.selectedResource());

        final var providerStatus = aiProvider.status();
        final var execution = executionRegistry.create(
            loginId,
            command.teamId(),
            command.projectId(),
            providerStatus.provider(),
            PROMPT_VERSION
        );
        executionRegistry.markRunning(execution.executionId());

        AiProviderResult result;
        try {
            result = outputValidator.validate(
                aiProvider.execute(
                    new AiProviderRequest(
                        execution.executionId(),
                        PROMPT_VERSION,
                        command.userMessage(),
                        command.locale(),
                        sanitizedContext(loginId, command)
                    )
                )
            );
        } catch (BusinessException ex) {
            result = AiProviderResult.failed(
                new AiProviderError(
                    "OUTPUT_VALIDATION_FAILED",
                    "Provider output validation failed",
                    "The AI provider returned invalid structured output.",
                    false
                )
            );
        } catch (RuntimeException ex) {
            result = AiProviderResult.failed(
                new AiProviderError("PROVIDER_FAILED", "Provider execution failed", "The AI provider failed safely.", true)
            );
        }

        if (result.error() == null) {
            executionRegistry.markSucceeded(execution.executionId(), result);
        } else {
            executionRegistry.markFailed(execution.executionId(), result);
        }
        final var completed = executionRegistry.get(execution.executionId(), loginId);
        auditService.record(completed);
        return AiExecutionView.from(completed);
    }

    public AiExecutionView getExecution(String loginId, String executionId) {
        return AiExecutionView.from(executionRegistry.get(executionId, loginId));
    }

    public AiExecutionView cancelExecution(String loginId, String executionId) {
        final var execution = executionRegistry.cancel(executionId, loginId);
        auditService.record(execution);
        return AiExecutionView.from(execution);
    }

    private Map<String, Object> sanitizedContext(String loginId, ExecuteCommand command) {
        return Map.of(
            "teamId",
            command.teamId(),
            "projectId",
            command.projectId(),
            "loginId",
            loginId,
            "locale",
            command.locale() == null ? "" : command.locale()
        );
    }

    public record ExecuteCommand(
        Long teamId,
        Long projectId,
        String userMessage,
        String locale,
        AiSelectedResource selectedResource
    ) {}

    public record AiProviderStatusView(String provider, String availability, String message, Instant checkedAt) {}

    public record AiExecutionView(
        String executionId,
        String provider,
        String promptVersion,
        AiExecutionState state,
        Instant createdAt,
        Instant startedAt,
        Instant completedAt,
        Long durationMs,
        String answer,
        List<AiActionDraft> actions,
        AiProviderError error
    ) {
        static AiExecutionView from(AiExecutionRegistry.ExecutionSnapshot execution) {
            final var result = execution.result();
            return new AiExecutionView(
                execution.executionId(),
                execution.provider(),
                execution.promptVersion(),
                execution.state(),
                execution.createdAt(),
                execution.startedAt(),
                execution.completedAt(),
                execution.durationMs(),
                result == null ? null : result.answer(),
                result == null ? List.of() : result.actions(),
                result == null ? null : result.error()
            );
        }
    }
}
