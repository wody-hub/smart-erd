package com.smarterd.application.ai;

import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.application.ai.provider.AiProviderRequest;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.application.ai.provider.AiProviderStatus;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import com.smarterd.domain.common.exception.BusinessException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Shared provider execution lifecycle runner.
 */
@Service
@RequiredArgsConstructor
public class AiProviderExecutionRunner {

    private final AiExecutionAuditService auditService;
    private final AiProvider aiProvider;
    private final AiExecutionRegistry executionRegistry;
    private final ProviderOutputValidator outputValidator;

    public AiProviderStatus status() {
        return aiProvider.status();
    }

    public AiExecutionGateway.AiExecutionView execute(String loginId, RunCommand command) {
        final var providerStatus = aiProvider.status();
        final var execution = executionRegistry.create(
            loginId,
            command.teamId(),
            command.projectId(),
            providerStatus.provider(),
            command.promptVersion()
        );
        executionRegistry.registerCancelHandler(execution.executionId(), () -> aiProvider.cancel(execution.executionId()));
        executionRegistry.markRunning(execution.executionId());

        final AiProviderResult result = runProvider(execution.executionId(), command);
        if (result.error() == null) {
            executionRegistry.markSucceeded(execution.executionId(), result);
        } else {
            executionRegistry.markFailed(execution.executionId(), result);
        }
        final var completed = executionRegistry.get(execution.executionId(), loginId);
        auditService.record(completed);
        return AiExecutionGateway.AiExecutionView.from(completed);
    }

    public AiExecutionGateway.AiExecutionView getExecution(String loginId, String executionId) {
        return AiExecutionGateway.AiExecutionView.from(executionRegistry.get(executionId, loginId));
    }

    public AiExecutionGateway.AiExecutionView cancelExecution(String loginId, String executionId) {
        final var execution = executionRegistry.cancel(executionId, loginId);
        auditService.record(execution);
        return AiExecutionGateway.AiExecutionView.from(execution);
    }

    private AiProviderResult runProvider(String executionId, RunCommand command) {
        try {
            return outputValidator.validate(
                aiProvider.execute(
                    new AiProviderRequest(
                        executionId,
                        command.promptVersion(),
                        command.userMessage(),
                        command.locale(),
                        command.providerContext()
                    )
                )
            );
        } catch (BusinessException ex) {
            return AiProviderResult.failed(
                new AiProviderError(
                    "OUTPUT_VALIDATION_FAILED",
                    "Provider output validation failed",
                    "The AI provider returned invalid structured output.",
                    false
                )
            );
        } catch (RuntimeException ex) {
            return AiProviderResult.failed(
                new AiProviderError("PROVIDER_FAILED", "Provider execution failed", "The AI provider failed safely.", true)
            );
        }
    }

    public record RunCommand(
        Long teamId,
        Long projectId,
        String userMessage,
        String locale,
        String promptVersion,
        Map<String, Object> providerContext
    ) {
        public RunCommand {
            promptVersion = promptVersion == null || promptVersion.isBlank()
                ? AiExecutionGateway.PROMPT_VERSION
                : promptVersion;
            providerContext = providerContext == null ? Map.of() : Map.copyOf(providerContext);
        }
    }
}
