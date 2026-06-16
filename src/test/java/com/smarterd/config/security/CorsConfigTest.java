package com.smarterd.config.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CorsConfigTest {

    private final CorsConfig corsConfig = new CorsConfig();

    @Test
    @DisplayName("corsConfigurationSource - credentials 허용 시 wildcard origin을 거부한다")
    void corsConfigurationSource_whenCredentialsAndWildcardOrigin_throwsException() {
        // given
        final var properties = new CorsConfig.CorsProperties();
        properties.setAllowCredentials(true);
        properties.setAllowedOrigins(List.of(" * "));

        // when & then
        assertThatThrownBy(() -> corsConfig.corsConfigurationSource(properties))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("wildcard origin")
            .hasMessageContaining("allowCredentials");
    }

    @Test
    @DisplayName("corsConfigurationSource - credentials 미허용 시 wildcard origin을 허용한다")
    void corsConfigurationSource_whenCredentialsDisabledAndWildcardOrigin_doesNotThrow() {
        // given
        final var properties = new CorsConfig.CorsProperties();
        properties.setAllowCredentials(false);
        properties.setAllowedOrigins(List.of("*"));

        // when & then
        assertThatCode(() -> corsConfig.corsConfigurationSource(properties)).doesNotThrowAnyException();
    }
}
