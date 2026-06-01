package com.smarterd.application.ai.provider;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import com.smarterd.domain.common.exception.BusinessException;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Local Codex CLI-backed AI provider.
 */
public class LocalCodexProcessProvider implements AiProvider {

    private final CodexProcessRunner runner;
    private final ProviderOutputValidator outputValidator;
    private final Supplier<AiProviderStatus> statusSupplier;
    private final String executable;
    private final Duration timeout;
    private final Path outputSchemaPath;
    private final String promptTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LocalCodexProcessProvider(
        CodexProcessRunner runner,
        ProviderOutputValidator outputValidator,
        Supplier<AiProviderStatus> statusSupplier,
        String executable,
        Duration timeout,
        Path outputSchemaPath
    ) {
        this(runner, outputValidator, statusSupplier, executable, timeout, outputSchemaPath, null);
    }

    public LocalCodexProcessProvider(
        CodexProcessRunner runner,
        ProviderOutputValidator outputValidator,
        Supplier<AiProviderStatus> statusSupplier,
        String executable,
        Duration timeout,
        Path outputSchemaPath,
        String promptTemplate
    ) {
        this.runner = runner;
        this.outputValidator = outputValidator;
        this.statusSupplier = statusSupplier;
        this.executable = executable;
        this.timeout = timeout;
        this.outputSchemaPath = outputSchemaPath;
        this.promptTemplate = promptTemplate;
    }

    @Override
    public AiProviderStatus status() {
        return statusSupplier.get();
    }

    @Override
    public AiProviderResult execute(AiProviderRequest request) {
        final var result = runner.run(
            new CodexProcessRequest(
                request.executionId(),
                executable,
                renderPrompt(request),
                outputSchemaPath,
                timeout,
                System.getenv()
            )
        );
        return switch (result.status()) {
            case SUCCEEDED -> validate(result.stdout());
            case CODEX_NOT_FOUND -> failed("CODEX_NOT_FOUND", "Codex executable was not found", false);
            case TIMED_OUT -> failed("TIMED_OUT", "Codex execution timed out", true);
            case CANCELLED -> failed("CANCELLED", "Codex execution was cancelled", false);
            case UNSUPPORTED_ENVIRONMENT -> failed("UNSUPPORTED_ENVIRONMENT", "Codex environment is unsupported", false);
            case FAILED -> failed("CODEX_EXEC_FAILED", "Codex execution failed", true);
        };
    }

    @Override
    public void cancel(String executionId) {
        runner.cancel(executionId);
    }

    private AiProviderResult validate(String stdout) {
        try {
            return outputValidator.validate(stdout);
        } catch (BusinessException ex) {
            return failed("OUTPUT_VALIDATION_FAILED", "Provider output validation failed", false);
        }
    }

    private String renderPrompt(AiProviderRequest request) {
        try {
            return """
            %s

            Execution:
            %s

            Sanitized context:
            %s

            User message:
            %s
            """.formatted(
                promptTemplate == null ? "Return JSON only, matching the configured output schema." : promptTemplate,
                request.executionId(),
                objectMapper.writeValueAsString(request.context()),
                request.userMessage()
            );
        } catch (JsonProcessingException ex) {
            return request.userMessage();
        }
    }

    private AiProviderResult failed(String type, String title, boolean retryable) {
        return AiProviderResult.failed(new AiProviderError(type, title, "The local Codex provider failed safely.", retryable));
    }
}
