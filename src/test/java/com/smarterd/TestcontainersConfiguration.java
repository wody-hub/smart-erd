package com.smarterd;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Testcontainers 기반 PostgreSQL 테스트 설정.
 *
 * <p>{@link ServiceConnection}을 통해 컨테이너 접속 정보가 Spring datasource에 자동 주입된다.</p>
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    /** 테스트용 PostgreSQL 17 컨테이너 */
    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>("postgres:17");
    }
}
