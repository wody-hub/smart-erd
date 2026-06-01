package com.smarterd.application.ai.provider;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Fixed local Codex CLI process boundary.
 */
public class CodexProcessRunner {

    private static final Set<String> ENV_ALLOWLIST = Set.of(
        "PATH",
        "HOME",
        "USER",
        "LOGNAME",
        "SHELL",
        "TMPDIR",
        "TEMP",
        "TMP",
        "CODEX_HOME",
        "XDG_CONFIG_HOME",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR"
    );

    private final ProcessLauncher processLauncher;

    public CodexProcessRunner(ProcessLauncher processLauncher) {
        this.processLauncher = processLauncher;
    }

    public CodexProcessResult run(CodexProcessRequest request) {
        Path cwd = null;
        try {
            cwd = Files.createTempDirectory("smart-erd-ai-");
            final var launchResult = processLauncher.launch(
                new ProcessLauncher.LaunchRequest(
                    request.executionId(),
                    buildCommand(request, cwd),
                    cwd,
                    filterEnvironment(request.hostEnvironment()),
                    request.prompt(),
                    request.timeout()
                )
            );
            return mapResult(launchResult);
        } catch (IOException ex) {
            return new CodexProcessResult(CodexProcessResult.Status.UNSUPPORTED_ENVIRONMENT, "", "UNSUPPORTED_ENVIRONMENT");
        } finally {
            cleanup(cwd);
        }
    }

    public void cancel(String executionId) {
        processLauncher.cancel(executionId);
    }

    private List<String> buildCommand(CodexProcessRequest request, Path cwd) {
        final var command = new ArrayList<String>();
        command.add(request.executable());
        command.add("exec");
        command.add("--cd");
        command.add(cwd.toString());
        command.add("--sandbox");
        command.add("workspace-write");
        command.add("-c");
        command.add("approval_policy=\"never\"");
        if (request.outputSchemaPath() != null) {
            command.add("--output-schema");
            command.add(request.outputSchemaPath().toString());
        }
        command.add("-");
        return List.copyOf(command);
    }

    private Map<String, String> filterEnvironment(Map<String, String> source) {
        return source
            .entrySet()
            .stream()
            .filter((entry) -> ENV_ALLOWLIST.contains(entry.getKey()))
            .filter((entry) -> !isSensitiveName(entry.getKey()))
            .collect(java.util.stream.Collectors.toUnmodifiableMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private boolean isSensitiveName(String name) {
        final var upper = name.toUpperCase(Locale.ROOT);
        return (
            upper.startsWith("SMART_ERD_") ||
            upper.startsWith("SPRING_") ||
            upper.contains("JWT") ||
            upper.contains("TOKEN") ||
            upper.contains("PASSWORD") ||
            upper.contains("DATASOURCE") ||
            upper.contains("COOKIE") ||
            upper.contains("SECRET")
        );
    }

    private CodexProcessResult mapResult(ProcessLauncher.Result result) {
        if (result.cancelled()) {
            return new CodexProcessResult(CodexProcessResult.Status.CANCELLED, "", "CANCELLED");
        }
        if (result.timedOut()) {
            return new CodexProcessResult(CodexProcessResult.Status.TIMED_OUT, "", "TIMED_OUT");
        }
        if (result.exitCode() == 127) {
            return new CodexProcessResult(CodexProcessResult.Status.CODEX_NOT_FOUND, "", "CODEX_NOT_FOUND");
        }
        if (result.exitCode() != 0) {
            return new CodexProcessResult(CodexProcessResult.Status.FAILED, "", "CODEX_EXEC_FAILED");
        }
        return new CodexProcessResult(CodexProcessResult.Status.SUCCEEDED, result.stdout(), null);
    }

    private void cleanup(Path cwd) {
        if (cwd == null) {
            return;
        }
        try (var stream = Files.walk(cwd)) {
            stream.sorted(Comparator.reverseOrder()).forEach((path) -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // Best-effort temp cleanup only.
                }
            });
        } catch (IOException ignored) {
            // Best-effort temp cleanup only.
        }
    }
}
