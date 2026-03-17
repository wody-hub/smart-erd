package com.smarterd.config.persistence;

import com.blazebit.persistence.Criteria;
import com.blazebit.persistence.CriteriaBuilderFactory;
import jakarta.persistence.EntityManagerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Blaze-Persistence 설정.
 *
 * <p>{@link CriteriaBuilderFactory} 빈을 등록하여 CTE, Keyset Pagination 등
 * 고급 쿼리 인프라를 사용할 수 있도록 준비한다.</p>
 */
@Configuration
public class BlazeConfig {

    /**
     * {@link CriteriaBuilderFactory} 빈을 생성한다.
     *
     * @param entityManagerFactory JPA EntityManagerFactory
     * @return CriteriaBuilderFactory 인스턴스
     */
    @Bean
    public CriteriaBuilderFactory criteriaBuilderFactory(EntityManagerFactory entityManagerFactory) {
        return Criteria.getDefault().createCriteriaBuilderFactory(entityManagerFactory);
    }
}
