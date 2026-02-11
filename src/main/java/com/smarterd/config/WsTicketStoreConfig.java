package com.smarterd.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.diagram.websocket.InMemoryWsTicketStore;
import com.smarterd.domain.diagram.websocket.RedisWsTicketStore;
import com.smarterd.domain.diagram.websocket.WsTicketStore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * WsTicketStore 구현체 빈 등록 설정.
 *
 * <p>{@code smart-erd.websocket.ticket-store} 프로퍼티에 따라
 * in-memory 또는 Redis 구현체를 선택적으로 등록한다.</p>
 */
@Configuration
public class WsTicketStoreConfig {

    /**
     * In-memory ticket 저장소 빈.
     *
     * <p>설정이 없거나 {@code in-memory}일 때 기본으로 사용된다.</p>
     *
     * @return InMemoryWsTicketStore 인스턴스
     */
    @Bean
    @ConditionalOnProperty(name = "smart-erd.websocket.ticket-store", havingValue = "in-memory", matchIfMissing = true)
    public WsTicketStore inMemoryWsTicketStore() {
        return new InMemoryWsTicketStore();
    }

    /**
     * Redis ticket 저장소 설정.
     *
     * <p>{@code smart-erd.websocket.ticket-store=redis}일 때만 활성화되며,
     * RedisAutoConfiguration을 명시적으로 Import하여 Redis 연결을 설정한다.</p>
     */
    @Configuration
    @ConditionalOnProperty(name = "smart-erd.websocket.ticket-store", havingValue = "redis")
    @Import(RedisAutoConfiguration.class)
    static class RedisTicketStoreConfig {

        /**
         * Redis ticket 저장소 빈.
         *
         * @param redisTemplate Redis 문자열 템플릿
         * @param objectMapper  JSON 직렬화/역직렬화용 ObjectMapper
         * @return RedisWsTicketStore 인스턴스
         */
        @Bean
        public WsTicketStore redisWsTicketStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
            return new RedisWsTicketStore(redisTemplate, objectMapper);
        }
    }
}
