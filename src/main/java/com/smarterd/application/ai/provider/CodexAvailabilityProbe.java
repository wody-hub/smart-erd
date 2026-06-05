package com.smarterd.application.ai.provider;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Safe local Codex runtime availability probe.
 */
public class CodexAvailabilityProbe {

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

    private final String executable;
    private final ProcessLauncher processLauncher;
    private final Clock clock;

    public CodexAvailabilityProbe(String executable, ProcessLauncher processLauncher, Clock clock) {
        this.executable = executable;
        this.processLauncher = processLauncher;
        this.clock = clock;
    }

    public AiProviderStatus status() {
        final var result = processLauncher.launch(
            new ProcessLauncher.LaunchRequest(
                "codex-probe",
                List.of(executable, "--version"),
                Path.of(System.getProperty("java.io.tmpdir")),
                safeHostEnvironment(),
                "",
                Duration.ofSeconds(5)
            )
        );
        if (result.exitCode() == 0) {
            return new AiProviderStatus(
                "local-codex",
                AiProviderAvailability.AVAILABLE,
                "Codex executable is available.",
                clock.instant()
            );
        }
        if (result.exitCode() == 127) {
            return new AiProviderStatus(
                "local-codex",
                AiProviderAvailability.CODEX_NOT_FOUND,
                "Codex executable was not found.",
                clock.instant()
            );
        }
        return new AiProviderStatus(
            "local-codex",
            AiProviderAvailability.UNSUPPORTED_ENVIRONMENT,
            "Codex executable could not be used non-interactively.",
            clock.instant()
        );
    }

    private Map<String, String> safeHostEnvironment() {
        return System.getenv()
            .entrySet()
            .stream()
            .filter((entry) -> ENV_ALLOWLIST.contains(entry.getKey()))
            .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, Map.Entry::getValue));
    }
}
