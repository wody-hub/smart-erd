package com.smarterd.config.dictionary;

import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

/**
 * 사전 대량 업로드 검증 세션 Redis 설정.
 *
 * <p>애플리케이션 기본 Redis 자동설정이 제외되어 있으므로,
 * bulk 검증 세션 저장에 필요한 RedisAutoConfiguration을 명시적으로 import한다.</p>
 */
@Configuration
@Import(RedisAutoConfiguration.class)
public class BulkValidationSessionRedisConfig {}
