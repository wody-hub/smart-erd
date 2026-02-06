package com.smarterd;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Smart ERD 애플리케이션의 진입점.
 *
 * <p>Spring Boot 자동 구성과 JPA Auditing({@code @EnableJpaAuditing})을 활성화하여
 * {@link com.smarterd.domain.common.entity.BaseTimeEntity}의 {@code createdAt}, {@code updatedAt} 자동 관리를 지원한다.</p>
 */
@SpringBootApplication
@EnableJpaAuditing
public class SmartErdApplication {

    /**
     * 애플리케이션을 기동한다.
     *
     * @param args 커맨드라인 인자
     */
    public static void main(String[] args) {
        SpringApplication.run(SmartErdApplication.class, args);
    }
}
