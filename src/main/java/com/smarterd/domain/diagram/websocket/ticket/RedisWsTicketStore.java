package com.smarterd.domain.diagram.websocket.ticket;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.lang.Nullable;

/**
 * Redis 기반 ticket 저장소.
 *
 * <p>수평 확장(scale-out) 환경에서 서버 간 ticket 공유를 지원한다.
 * ticket TTL은 Redis EXPIRE로 자동 관리되므로 별도 정리 스케줄러가 불필요하다.</p>
 */
@Slf4j
public class RedisWsTicketStore implements WsTicketStore {

    /** ticket 키 접두사 */
    private static final String TICKET_KEY_PREFIX = "ws:ticket:";

    /** 사용자별 ticket 집합 키 접두사 */
    private static final String USER_SET_KEY_PREFIX = "ws:tickets:user:";

    /** 중복 방지 역인덱스 키 접두사 */
    private static final String DIAGRAM_KEY_PREFIX = "ws:tickets:diagram:";

    /** 사용자별 ticket 집합 TTL (ticket TTL보다 충분히 긴 값) */
    private static final Duration USER_SET_TTL = Duration.ofMinutes(5);

    /** consume Lua 스크립트 classpath 경로 */
    private static final String CONSUME_SCRIPT_PATH = "lua/ws-ticket-consume.lua";

    /** count Lua 스크립트 classpath 경로 */
    private static final String COUNT_SCRIPT_PATH = "lua/ws-ticket-count.lua";

    /** issue Lua 스크립트 classpath 경로 */
    private static final String ISSUE_SCRIPT_PATH = "lua/ws-ticket-issue.lua";

    /** remove Lua 스크립트 classpath 경로 */
    private static final String REMOVE_SCRIPT_PATH = "lua/ws-ticket-remove.lua";

    /**
     * 원자적 consume Lua 스크립트.
     *
     * <p>KEYS[1]=ticket키, ARGV[1]=ticket ID, ARGV[2]=userSet키 접두사, ARGV[3]=diagram키 접두사.
     * ticket JSON을 cjson.decode로 파싱하여 보조 인덱스 키를 내부에서 산출한 뒤,
     * ticket 삭제 + user SET에서 제거 + diagram 역인덱스 삭제를 원자적으로 수행하고 JSON을 반환한다.</p>
     */
    private static final DefaultRedisScript<String> CONSUME_SCRIPT = loadScript(CONSUME_SCRIPT_PATH, String.class);

    /**
     * user SET에서 만료된 ticket을 정리하고 유효 수를 반환하는 Lua 스크립트.
     *
     * <p>KEYS[1]=userSet키, ARGV[1]=ticket키 접두사.
     * SET 멤버를 순회하며 primary key 존재 여부를 검증하고, 만료된 엔트리를 제거한 뒤 유효 수를 반환한다.</p>
     */
    private static final DefaultRedisScript<Long> COUNT_SCRIPT = loadScript(COUNT_SCRIPT_PATH, Long.class);

    /**
     * (loginId, diagramId) 교체 + 상한 검사 + 신규 저장을 원자적으로 수행하는 Lua 스크립트.
     *
     * <p>KEYS[1]=newTicketKey, KEYS[2]=userSetKey, KEYS[3]=diagramKey.
     * ARGV[1]=newTicketId, ARGV[2]=ticketJson, ARGV[3]=ttlSec, ARGV[4]=maxOutstanding,
     * ARGV[5]=ticketKeyPrefix, ARGV[6]=userSetTtlSec.</p>
     */
    private static final DefaultRedisScript<Long> ISSUE_SCRIPT = loadScript(ISSUE_SCRIPT_PATH, Long.class);

    /**
     * (loginId, diagramId) 역인덱스 기반 ticket 제거를 원자적으로 수행하는 Lua 스크립트.
     *
     * <p>KEYS[1]=diagramKey, KEYS[2]=userSetKey, ARGV[1]=ticketKeyPrefix.
     * diagram 역인덱스에서 ticket ID를 읽고, ticket primary key + user SET에서 원자적으로 제거한다.</p>
     */
    private static final DefaultRedisScript<Long> REMOVE_SCRIPT = loadScript(REMOVE_SCRIPT_PATH, Long.class);

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

    /**
     * classpath의 Lua 파일을 읽어 {@link DefaultRedisScript} 객체를 생성한다.
     *
     * @param path       classpath 기준 Lua 파일 경로
     * @param resultType 스크립트 반환 타입
     * @param <T>        스크립트 반환 제네릭 타입
     * @return 로드된 Redis Lua 스크립트 객체
     */
    private static <T> DefaultRedisScript<T> loadScript(String path, Class<T> resultType) {
        final var script = new DefaultRedisScript<T>();
        script.setLocation(new ClassPathResource(Objects.requireNonNull(path)));
        script.setResultType(Objects.requireNonNull(resultType));
        return script;
    }

    @Override
    public boolean issueTicketAtomically(String ticket, TicketData data, Duration ttl, int maxOutstanding) {
        final var ticketKey = TICKET_KEY_PREFIX + ticket;
        final var userSetKey = USER_SET_KEY_PREFIX + data.loginId();
        final var diagramKey = DIAGRAM_KEY_PREFIX + data.loginId() + ":" + data.diagramId();

        try {
            final var json = Objects.requireNonNull(objectMapper.writeValueAsString(data));
            final var result = redisTemplate.execute(
                Objects.requireNonNull(ISSUE_SCRIPT),
                Objects.requireNonNull(List.of(ticketKey, userSetKey, diagramKey)),
                ticket,
                json,
                String.valueOf(ttl.toSeconds()),
                String.valueOf(maxOutstanding),
                TICKET_KEY_PREFIX,
                String.valueOf(USER_SET_TTL.toSeconds())
            );
            return result != null && result == 1L;
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("TicketData JSON 직렬화 실패", e);
        }
    }

    @Override
    public Optional<TicketData> consume(String ticket) {
        final var ticketKey = TICKET_KEY_PREFIX + ticket;

        // Lua 스크립트로 원자적 GET + DEL + cjson.decode + SREM + DEL 수행.
        // Lua 내부에서 ticket JSON을 파싱하여 보조 인덱스 키를 산출하므로
        // Java 측 사전 GET이 불필요하며, 동시 consume 경쟁 시 하나만 성공한다.
        final var consumedJson = executeConsumeScript(ticketKey, ticket);
        if (consumedJson == null) {
            return Optional.empty();
        }

        final TicketData data;
        try {
            data = objectMapper.readValue(consumedJson, TicketData.class);
        } catch (JsonProcessingException e) {
            log.warn("TicketData JSON 역직렬화 실패: ticket={}", ticket, e);
            return Optional.empty();
        }

        if (data.expiresAt().isBefore(Instant.now())) {
            log.debug("WebSocket ticket 만료: loginId={}", data.loginId());
            return Optional.empty();
        }

        return Optional.of(data);
    }

    /**
     * consume Lua 스크립트를 실행하고 결과 JSON을 반환한다.
     *
     * <p>{@code @NonNullApi} 패키지에서 {@code redisTemplate.execute()} 반환값이
     * non-null로 추론되는 것을 방지하기 위해 {@code @Nullable} 반환 타입으로 감싼다.</p>
     *
     * @param ticketKey Redis ticket 키
     * @param ticket    ticket ID
     * @return ticket JSON 문자열, ticket이 없으면 {@code null}
     */
    @Nullable
    private String executeConsumeScript(String ticketKey, String ticket) {
        return redisTemplate.execute(
            Objects.requireNonNull(CONSUME_SCRIPT),
            Objects.requireNonNull(List.of(ticketKey)),
            ticket,
            USER_SET_KEY_PREFIX,
            DIAGRAM_KEY_PREFIX
        );
    }

    @Override
    public void removeByLoginIdAndDiagramId(String loginId, Long diagramId) {
        final var diagramKey = DIAGRAM_KEY_PREFIX + loginId + ":" + diagramId;
        final var userSetKey = USER_SET_KEY_PREFIX + loginId;
        redisTemplate.execute(
            Objects.requireNonNull(REMOVE_SCRIPT),
            Objects.requireNonNull(List.of(diagramKey, userSetKey)),
            TICKET_KEY_PREFIX
        );
    }

    @Override
    public long countByLoginId(String loginId) {
        final var userSetKey = USER_SET_KEY_PREFIX + loginId;
        final var result = redisTemplate.execute(
            Objects.requireNonNull(COUNT_SCRIPT),
            Objects.requireNonNull(List.of(userSetKey)),
            TICKET_KEY_PREFIX
        );
        return result != null ? result : 0;
    }
}
