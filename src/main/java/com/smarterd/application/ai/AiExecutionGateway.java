package com.smarterd.application.ai;

import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.application.ai.provider.AiProviderError;
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
    private final AiProviderExecutionRunner providerExecutionRunner;

    public AiProviderStatusView status() {
        final var status = providerExecutionRunner.status();
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

        return providerExecutionRunner.execute(
            loginId,
            new AiProviderExecutionRunner.RunCommand(
                command.teamId(),
                command.projectId(),
                command.userMessage(),
                command.locale(),
                PROMPT_VERSION,
                sanitizedContext(command)
            )
        );
    }

    public AiExecutionView getExecution(String loginId, String executionId) {
        return providerExecutionRunner.getExecution(loginId, executionId);
    }

    public AiExecutionView cancelExecution(String loginId, String executionId) {
        return providerExecutionRunner.cancelExecution(loginId, executionId);
    }

    private Map<String, Object> sanitizedContext(ExecuteCommand command) {
        return Map.of(
            "teamId",
            command.teamId(),
            "projectId",
            command.projectId(),
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
