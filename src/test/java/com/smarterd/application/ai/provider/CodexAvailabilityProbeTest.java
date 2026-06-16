package com.smarterd.application.ai.provider;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class CodexAvailabilityProbeTest {

    @Test
    void probeUsesVersionCommandAndReturnsSafeAvailability() {
        final var launcher = new CapturingLauncher(new ProcessLauncher.Result(0, "codex 1.0", "", false, false));
        final var probe = new CodexAvailabilityProbe("codex", launcher, Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

        final var status = probe.status();

        assertThat(status.provider()).isEqualTo("local-codex");
        assertThat(status.availability()).isEqualTo(AiProviderAvailability.AVAILABLE);
        assertThat(launcher.request.command()).isEqualTo(List.of("codex", "--version"));
        assertThat(launcher.request.environment()).containsKey("PATH");
        assertThat(status.message()).doesNotContain("/Users", "stderr", "stdout");
    }

    @Test
    void probeMapsMissingExecutableWithoutLeakingPath() {
        final var launcher = new CapturingLauncher(
            new ProcessLauncher.Result(127, "", "missing /secret/path", false, false)
        );
        final var probe = new CodexAvailabilityProbe(
            "/secret/path/codex",
            launcher,
            Clock.fixed(Instant.EPOCH, ZoneOffset.UTC)
        );

        final var status = probe.status();

        assertThat(status.availability()).isEqualTo(AiProviderAvailability.CODEX_NOT_FOUND);
        assertThat(status.message()).doesNotContain("/secret/path");
    }

    private static final class CapturingLauncher implements ProcessLauncher {

        private final Result result;
        private LaunchRequest request;

        private CapturingLauncher(Result result) {
            this.result = result;
        }

        @Override
        public Result launch(LaunchRequest request) {
            this.request = request;
            return result;
        }

        @Override
        public void cancel(String executionId) {}
    }
}
