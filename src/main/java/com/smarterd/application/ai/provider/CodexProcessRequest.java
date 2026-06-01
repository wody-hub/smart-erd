package com.smarterd.application.ai.provider;

import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;

/**
 * Request for a local Codex process invocation.
 *
 * @param executionId execution id
 * @param executable configured executable
 * @param prompt prompt text sent through stdin
 * @param outputSchemaPath optional JSON schema file
 * @param timeout process timeout
 * @param hostEnvironment candidate host environment to filter
 */
public record CodexProcessRequest(
    String executionId,
    String executable,
    String prompt,
    Path outputSchemaPath,
    Duration timeout,
    Map<String, String> hostEnvironment
) {
    public CodexProcessRequest {
        hostEnvironment = hostEnvironment == null ? Map.of() : Map.copyOf(hostEnvironment);
    }
}
