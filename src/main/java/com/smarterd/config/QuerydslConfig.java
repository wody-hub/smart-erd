package com.smarterd.config;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * QueryDSL 설정.
 *
 * <p>{@link JPAQueryFactory} 빈을 등록하여 타입 안전한 JPQL 빌더를 제공한다.
 * Spring이 주입하는 {@link EntityManager}는 shared proxy이므로 스레드 안전하다.</p>
 */
@Configuration
public class QuerydslConfig {

    /**
     * {@link JPAQueryFactory} 빈을 생성한다.
     *
     * @param entityManager JPA EntityManager (Spring shared proxy)
     * @return JPAQueryFactory 인스턴스
     */
    @Bean
    public JPAQueryFactory jpaQueryFactory(EntityManager entityManager) {
        return new JPAQueryFactory(entityManager);
    }
}
