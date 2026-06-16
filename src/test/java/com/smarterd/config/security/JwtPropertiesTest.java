package com.smarterd.config.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class JwtPropertiesTest {

    @Test
    @DisplayName("validateSecret - 운영 프로파일에서 기본 JWT 시크릿을 거부한다")
    void validateSecret_whenProductionProfileUsesDefaultSecret_throwsException() {
        // given
        final var properties = new JwtProperties();
        properties.setEnvironment(new MockEnvironment().withProperty("spring.profiles.active", "prod"));
        properties.setSecret(JwtProperties.DEV_DEFAULT_SECRET);

        // when & then
        assertThatThrownBy(properties::validateSecret)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SMART_ERD_JWT_SECRET");
    }

    @Test
    @DisplayName("validateSecret - 개발 프로파일에서는 기본 JWT 시크릿을 허용한다")
    void validateSecret_whenDevelopmentProfileUsesDefaultSecret_doesNotThrow() {
        // given
        final var properties = new JwtProperties();
        properties.setEnvironment(new MockEnvironment().withProperty("spring.profiles.active", "local"));
        properties.setSecret(JwtProperties.DEV_DEFAULT_SECRET);

        // when & then
        assertThatCode(properties::validateSecret).doesNotThrowAnyException();
    }
}
