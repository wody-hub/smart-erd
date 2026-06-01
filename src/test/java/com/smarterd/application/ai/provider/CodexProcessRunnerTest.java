package com.smarterd.application.ai.provider;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CodexProcessRunnerTest {

    @Test
    void runBuildsFixedArgvTempCwdSandboxApprovalAndSchema() {
        final var launcher = new CapturingLauncher(
            new ProcessLauncher.Result(0, "{\"answer\":\"ok\",\"actions\":[]}", "", false, false)
        );
        final var runner = new CodexProcessRunner(launcher);
        final var schema = Path.of("/tmp/schema.json");

        final var result = runner.run(
            new CodexProcessRequest(
                "exec-1",
                "codex",
                "prompt",
                schema,
                Duration.ofSeconds(60),
                Map.of("PATH", "/usr/bin", "HOME", "/Users/tester")
            )
        );

        assertThat(result.status()).isEqualTo(CodexProcessResult.Status.SUCCEEDED);
        assertThat(launcher.request.command()).containsExactly(
            "codex",
            "exec",
            "--cd",
            launcher.request.cwd().toString(),
            "--sandbox",
            "workspace-write",
            "-c",
            "approval_policy=\"never\"",
            "--output-schema",
            schema.toString(),
            "-"
        );
        assertThat(launcher.request.command()).doesNotContain("/bin/sh", "cmd", "/c");
        assertThat(launcher.request.cwd().toString()).contains("smart-erd-ai-");
        assertThat(launcher.request.stdin()).isEqualTo("prompt");
    }

    @Test
    void runFiltersSensitiveEnvironmentVariables() {
        final var launcher = new CapturingLauncher(
            new ProcessLauncher.Result(0, "{\"answer\":\"ok\",\"actions\":[]}", "", false, false)
        );
        final var runner = new CodexProcessRunner(launcher);

        runner.run(
            new CodexProcessRequest(
                "exec-1",
                "codex",
                "prompt",
                null,
                Duration.ofSeconds(60),
                Map.of(
                    "PATH",
                    "/usr/bin",
                    "HOME",
                    "/Users/tester",
                    "CODEX_HOME",
                    "/Users/tester/.codex",
                    "SMART_ERD_JWT_SECRET",
                    "secret",
                    "SPRING_DATASOURCE_URL",
                    "jdbc:postgresql://localhost",
                    "JWT_TOKEN",
                    "jwt",
                    "COOKIE",
                    "cookie"
                )
            )
        );

        assertThat(launcher.request.environment()).containsKeys("PATH", "HOME", "CODEX_HOME");
        assertThat(launcher.request.environment()).doesNotContainKeys(
            "SMART_ERD_JWT_SECRET",
            "SPRING_DATASOURCE_URL",
            "JWT_TOKEN",
            "COOKIE"
        );
    }

    @Test
    void runMapsTimeoutAndCancel() {
        final var timeoutLauncher = new CapturingLauncher(new ProcessLauncher.Result(124, "", "timeout", true, false));
        final var timeout = new CodexProcessRunner(timeoutLauncher)
            .run(request("exec-timeout"));
        assertThat(timeout.status()).isEqualTo(CodexProcessResult.Status.TIMED_OUT);

        final var cancelLauncher = new CapturingLauncher(new ProcessLauncher.Result(143, "", "cancelled", false, true));
        final var cancelled = new CodexProcessRunner(cancelLauncher)
            .run(request("exec-cancel"));
        assertThat(cancelled.status()).isEqualTo(CodexProcessResult.Status.CANCELLED);
    }

    @Test
    void cancelDelegatesToLauncher() {
        final var launcher = new CapturingLauncher(new ProcessLauncher.Result(0, "", "", false, false));
        new CodexProcessRunner(launcher).cancel("exec-1");

        assertThat(launcher.cancelledExecutionId).isEqualTo("exec-1");
    }

    private CodexProcessRequest request(String executionId) {
        return new CodexProcessRequest(executionId, "codex", "prompt", null, Duration.ofSeconds(60), Map.of());
    }

    private static final class CapturingLauncher implements ProcessLauncher {

        private final Result result;
        private LaunchRequest request;
        private String cancelledExecutionId;

        private CapturingLauncher(Result result) {
            this.result = result;
        }

        @Override
        public Result launch(LaunchRequest request) {
            this.request = request;
            return result;
        }

        @Override
        public void cancel(String executionId) {
            this.cancelledExecutionId = executionId;
        }
    }
}
