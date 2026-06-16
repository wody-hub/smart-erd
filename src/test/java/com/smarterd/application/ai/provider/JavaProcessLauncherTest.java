package com.smarterd.application.ai.provider;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JavaProcessLauncherTest {

    @Test
    void launchDrainsStdoutAndStderrWhileProcessIsRunning() {
        final var launcher = new JavaProcessLauncher();
        final var javaBinary = Path.of(System.getProperty("java.home"), "bin", "java").toString();

        final var result = launcher.launch(
            new ProcessLauncher.LaunchRequest(
                "large-output",
                List.of(javaBinary, "-cp", System.getProperty("java.class.path"), LargeOutputProcess.class.getName()),
                Path.of(System.getProperty("java.io.tmpdir")),
                Map.of(),
                "",
                Duration.ofSeconds(3)
            )
        );

        assertThat(result.timedOut()).isFalse();
        assertThat(result.exitCode()).isEqualTo(0);
        assertThat(result.stdout()).contains("stdout-complete");
        assertThat(result.stderr()).contains("stderr-complete");
    }

    public static final class LargeOutputProcess {

        private static final int BLOCKS = 256;
        private static final String CHUNK = "x".repeat(1024);

        public static void main(String[] args) {
            for (var index = 0; index < BLOCKS; index++) {
                System.err.print(CHUNK);
            }
            System.err.println("stderr-complete");
            for (var index = 0; index < BLOCKS; index++) {
                System.out.print(CHUNK);
            }
            System.out.println("stdout-complete");
        }

        private LargeOutputProcess() {}
    }
}
