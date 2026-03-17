package com.smarterd.domain.dictionary.service.session;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.lang.Nullable;

/**
 * Redis 기반 벌크 업로드 검증 세션 저장소.
 */
public class RedisBulkValidationSessionStore implements BulkValidationSessionStore {

    private static final String CONSUME_SCRIPT_PATH = "lua/bulk-validation-consume.lua";
    private static final String CONSUME_RESULT_CONSUMED = "__CONSUMED__";
    private static final String CONSUME_RESULT_MISMATCH = "__MISMATCH__";
    private static final DefaultRedisScript<String> CONSUME_SCRIPT = loadScript(CONSUME_SCRIPT_PATH, String.class);

    private final StringRedisTemplate redisTemplate;

    public RedisBulkValidationSessionStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean putIfAbsent(String key, String payload, Duration ttl) {
        final var stored = redisTemplate.opsForValue().setIfAbsent(key, payload, ttl);
        return Boolean.TRUE.equals(stored);
    }

    @Override
    public ConsumeResult consume(String key, String loginId, Long teamId, Long setId) {
        final var consumeResult = redisTemplate.execute(
            Objects.requireNonNull(CONSUME_SCRIPT),
            Objects.requireNonNull(List.of(key)),
            loginId,
            String.valueOf(teamId),
            String.valueOf(setId)
        );
        if (consumeResult == null || consumeResult.isEmpty()) {
            return ConsumeResult.missing();
        }
        if (CONSUME_RESULT_MISMATCH.equals(consumeResult)) {
            return ConsumeResult.ownershipMismatch();
        }
        if (CONSUME_RESULT_CONSUMED.equals(consumeResult)) {
            return ConsumeResult.alreadyConsumed();
        }
        return ConsumeResult.success(consumeResult);
    }

    @Override
    @Nullable
    public String get(String key) {
        return redisTemplate.opsForValue().get(key);
    }

    @Override
    public void delete(String key) {
        redisTemplate.delete(key);
    }

    private static <T> DefaultRedisScript<T> loadScript(String path, Class<T> resultType) {
        final var script = new DefaultRedisScript<T>();
        script.setLocation(new ClassPathResource(Objects.requireNonNull(path)));
        script.setResultType(resultType);
        return script;
    }
}
