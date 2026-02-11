package com.smarterd.domain.diagram.websocket;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/**
 * Redis 기반 ticket 저장소.
 *
 * <p>수평 확장(scale-out) 환경에서 서버 간 ticket 공유를 지원한다.
 * ticket TTL은 Redis EXPIRE로 자동 관리되므로 별도 정리 스케줄러가 불필요하다.</p>
 */
@SuppressWarnings("null")
public class RedisWsTicketStore implements WsTicketStore {

    private static final Logger log = LoggerFactory.getLogger(RedisWsTicketStore.class);

    /** ticket 키 접두사 */
    private static final String TICKET_KEY_PREFIX = "ws:ticket:";

    /** 사용자별 ticket 집합 키 접두사 */
    private static final String USER_SET_KEY_PREFIX = "ws:tickets:user:";

    /** 중복 방지 역인덱스 키 접두사 */
    private static final String DIAGRAM_KEY_PREFIX = "ws:tickets:diagram:";

    /** 사용자별 ticket 집합 TTL (ticket TTL보다 충분히 긴 값) */
    private static final Duration USER_SET_TTL = Duration.ofMinutes(5);

    /**
     * 원자적 consume Lua 스크립트.
     *
     * <p>KEYS[1]=ticket키, KEYS[2]=userSet키, KEYS[3]=diagram키, ARGV[1]=ticket ID.
     * ticket 삭제 + user SET에서 제거 + diagram 역인덱스 삭제를 원자적으로 수행한다.</p>
     */
    private static final DefaultRedisScript<String> CONSUME_SCRIPT;

    /**
     * user SET에서 만료된 ticket을 정리하고 유효 수를 반환하는 Lua 스크립트.
     *
     * <p>KEYS[1]=userSet키, ARGV[1]=ticket키 접두사.
     * SET 멤버를 순회하며 primary key 존재 여부를 검증하고, 만료된 엔트리를 제거한 뒤 유효 수를 반환한다.</p>
     */
    private static final DefaultRedisScript<Long> COUNT_SCRIPT;

    static {
        CONSUME_SCRIPT = new DefaultRedisScript<>();
        CONSUME_SCRIPT.setScriptText(
            """
            local v = redis.call('GET', KEYS[1])
            if v then
                redis.call('DEL', KEYS[1])
                redis.call('SREM', KEYS[2], ARGV[1])
                redis.call('DEL', KEYS[3])
            end
            return v
            """
        );
        CONSUME_SCRIPT.setResultType(String.class);

        COUNT_SCRIPT = new DefaultRedisScript<>();
        COUNT_SCRIPT.setScriptText(
            """
            local members = redis.call('SMEMBERS', KEYS[1])
            local count = 0
            for _, ticket in ipairs(members) do
                if redis.call('EXISTS', ARGV[1] .. ticket) == 1 then
                    count = count + 1
                else
                    redis.call('SREM', KEYS[1], ticket)
                end
            end
            return count
            """
        );
        COUNT_SCRIPT.setResultType(Long.class);
    }

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * RedisWsTicketStore를 생성한다.
     *
     * @param redisTemplate Redis 문자열 템플릿
     * @param objectMapper  JSON 직렬화/역직렬화용 ObjectMapper
     */
    public RedisWsTicketStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void store(String ticket, TicketData data, Duration ttl) {
        final var ticketKey = TICKET_KEY_PREFIX + ticket;
        final var userSetKey = USER_SET_KEY_PREFIX + data.loginId();
        final var diagramKey = DIAGRAM_KEY_PREFIX + data.loginId() + ":" + data.diagramId();

        try {
            final var json = objectMapper.writeValueAsString(data);
            redisTemplate.opsForValue().set(ticketKey, json, ttl);
            redisTemplate.opsForSet().add(userSetKey, ticket);
            redisTemplate.expire(userSetKey, USER_SET_TTL);
            redisTemplate.opsForValue().set(diagramKey, ticket, ttl);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("TicketData JSON 직렬화 실패", e);
        }
    }

    @Override
    public Optional<TicketData> consume(String ticket) {
        final var ticketKey = TICKET_KEY_PREFIX + ticket;

        // 역직렬화를 위해 먼저 GET으로 데이터를 읽어 loginId/diagramId를 추출해야
        // Lua 스크립트에 보조 인덱스 키를 전달할 수 있다.
        final var rawJson = redisTemplate.opsForValue().get(ticketKey);
        if (rawJson == null) {
            return Optional.empty();
        }

        try {
            final var data = objectMapper.readValue(rawJson, TicketData.class);
            final var userSetKey = USER_SET_KEY_PREFIX + data.loginId();
            final var diagramKey = DIAGRAM_KEY_PREFIX + data.loginId() + ":" + data.diagramId();

            // Lua 스크립트로 원자적 DEL + SREM + DEL (보조 인덱스 포함)
            redisTemplate.execute(CONSUME_SCRIPT, List.of(ticketKey, userSetKey, diagramKey), ticket);

            if (data.expiresAt().isBefore(Instant.now())) {
                log.debug("WebSocket ticket 만료: loginId={}", data.loginId());
                return Optional.empty();
            }

            return Optional.of(data);
        } catch (JsonProcessingException e) {
            log.warn("TicketData JSON 역직렬화 실패: ticket={}", ticket, e);
            // 파싱 실패한 ticket은 정리
            redisTemplate.delete(ticketKey);
            return Optional.empty();
        }
    }

    @Override
    public void removeByLoginIdAndDiagramId(String loginId, Long diagramId) {
        final var diagramKey = DIAGRAM_KEY_PREFIX + loginId + ":" + diagramId;
        final var oldTicket = redisTemplate.opsForValue().getAndDelete(diagramKey);
        if (oldTicket != null) {
            redisTemplate.delete(TICKET_KEY_PREFIX + oldTicket);
            redisTemplate.opsForSet().remove(USER_SET_KEY_PREFIX + loginId, oldTicket);
        }
    }

    @Override
    public long countByLoginId(String loginId) {
        final var userSetKey = USER_SET_KEY_PREFIX + loginId;
        final var result = redisTemplate.execute(COUNT_SCRIPT, List.of(userSetKey), TICKET_KEY_PREFIX);
        return result != null ? result : 0;
    }
}
