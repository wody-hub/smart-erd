package com.smarterd.config.dictionary;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.dictionary.service.session.BulkValidationSessionStore;
import com.smarterd.domain.dictionary.service.session.InMemoryBulkValidationSessionStore;
import com.smarterd.domain.dictionary.service.session.RedisBulkValidationSessionStore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * 벌크 업로드 검증 세션 저장소 설정.
 *
 * <p>{@code smart-erd.dictionary.bulk-validation.store} 값에 따라
 * in-memory 또는 Redis 구현체를 선택 등록한다.</p>
 */
@Configuration
public class BulkValidationSessionStoreConfig {

    @Bean
    @ConditionalOnProperty(
        name = "smart-erd.dictionary.bulk-validation.store",
        havingValue = "in-memory",
        matchIfMissing = true
    )
    public BulkValidationSessionStore inMemoryBulkValidationSessionStore(ObjectMapper objectMapper) {
        return new InMemoryBulkValidationSessionStore(objectMapper);
    }

    @Configuration
    @ConditionalOnProperty(name = "smart-erd.dictionary.bulk-validation.store", havingValue = "redis")
    @Import(RedisAutoConfiguration.class)
    static class RedisStoreConfig {

        @Bean
        public BulkValidationSessionStore redisBulkValidationSessionStore(StringRedisTemplate redisTemplate) {
            return new RedisBulkValidationSessionStore(redisTemplate);
        }
    }
}
