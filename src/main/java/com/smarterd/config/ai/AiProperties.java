package com.smarterd.config.ai;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI provider gateway configuration.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "smart-erd.ai")
public class AiProperties {

    /** Selected AI provider adapter. */
    private String provider = "noop";

    /** Execution lifecycle settings. */
    private Execution execution = new Execution();

    /** Local Codex adapter settings. */
    private Codex codex = new Codex();

    @Getter
    @Setter
    public static class Execution {

        /** Provider call timeout. */
        private Duration timeout = Duration.ofSeconds(60);

        /** Recently completed execution retention window. */
        private Duration retention = Duration.ofMinutes(15);
    }

    @Getter
    @Setter
    public static class Codex {

        /** Executable name or absolute path. */
        private String executable = "codex";

        /** Opt-in local smoke test flag. */
        private boolean smokeEnabled = false;
    }
}
