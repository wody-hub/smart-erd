package com.smarterd.application.ai.provider;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

import org.junit.jupiter.api.Test;

class LocalCodexSmokeTest {

    @Test
    void localCodexSmokeIsOptIn() {
        assumeTrue(Boolean.getBoolean("smart-erd.ai.codex.smoke.enabled"));
    }
}
