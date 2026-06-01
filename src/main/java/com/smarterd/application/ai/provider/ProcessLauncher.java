package com.smarterd.application.ai.provider;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Launches an external process. Tests use fakes to inspect argv/env without spawning Codex.
 */
public interface ProcessLauncher {
    Result launch(LaunchRequest request);

    void cancel(String executionId);

    record LaunchRequest(
        String executionId,
        List<String> command,
        Path cwd,
        Map<String, String> environment,
        String stdin,
        Duration timeout
    ) {}

    record Result(int exitCode, String stdout, String stderr, boolean timedOut, boolean cancelled) {}
}
