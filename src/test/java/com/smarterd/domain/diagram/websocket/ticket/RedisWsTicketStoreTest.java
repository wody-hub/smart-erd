package com.smarterd.domain.diagram.websocket.ticket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

class RedisWsTicketStoreTest {

    @Test
    @DisplayName("issueTicketAtomically - Redis 스크립트 성공(1) 시 true를 반환한다")
    void issueTicketAtomically_whenScriptReturnsOne_returnsTrue() {
        // given
        final var redisTemplate = mock(StringRedisTemplate.class);
        final var store = new RedisWsTicketStore(redisTemplate, new ObjectMapper().findAndRegisterModules());
        final var data = new TicketData("u1", "login-1", "User 1", 100L, Instant.now().plusSeconds(30));
        final var ttl = Duration.ofSeconds(30);

        doReturn(1L)
            .when(redisTemplate)
            .execute(
                org.mockito.ArgumentMatchers.<RedisScript<Long>>any(),
                anyList(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()
            );

        // when
        final var issued = store.issueTicketAtomically("ticket-1", data, ttl, 10);

        // then
        assertThat(issued).isTrue();
        verify(redisTemplate)
            .execute(
                org.mockito.ArgumentMatchers.<RedisScript<Long>>any(),
                eq(List.of("ws:ticket:ticket-1", "ws:tickets:user:login-1", "ws:tickets:diagram:login-1:100")),
                eq("ticket-1"),
                any(),
                eq("30"),
                eq("10"),
                eq("ws:ticket:"),
                eq("300")
            );
    }

    @Test
    @DisplayName("issueTicketAtomically - Redis 스크립트 실패(0) 시 false를 반환한다")
    void issueTicketAtomically_whenScriptReturnsZero_returnsFalse() {
        // given
        final var redisTemplate = mock(StringRedisTemplate.class);
        final var store = new RedisWsTicketStore(redisTemplate, new ObjectMapper().findAndRegisterModules());
        final var data = new TicketData("u1", "login-1", "User 1", 100L, Instant.now().plusSeconds(30));
        final var ttl = Duration.ofSeconds(30);

        doReturn(0L)
            .when(redisTemplate)
            .execute(
                org.mockito.ArgumentMatchers.<RedisScript<Long>>any(),
                anyList(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()
            );

        // when
        final var issued = store.issueTicketAtomically("ticket-1", data, ttl, 1);

        // then
        assertThat(issued).isFalse();
    }
}
