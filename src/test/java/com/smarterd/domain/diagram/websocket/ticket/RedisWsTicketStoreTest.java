package com.smarterd.domain.diagram.websocket.ticket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.smarterd.collaboration.CollaborationProtocolPolicy;
import com.smarterd.config.websocket.CollaborationProperties;
import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.common.exception.ProtocolTooOldException;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.repository.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

class RedisWsTicketStoreTest {

    @Test
    @DisplayName("issueTicketAtomically - Redis 스크립트 성공(1) 시 true를 반환한다")
    void issueTicketAtomically_whenScriptReturnsOne_returnsTrue() {
        // given
        final var redisTemplate = mock(StringRedisTemplate.class);
        final var store = new RedisWsTicketStore(redisTemplate, new ObjectMapper().findAndRegisterModules());
        final var data = new TicketData("u1", "login-1", "User 1", 100L, Instant.now().plusSeconds(30), 1);
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
        verify(redisTemplate).execute(
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
        final var data = new TicketData("u1", "login-1", "User 1", 100L, Instant.now().plusSeconds(30), 1);
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

    @Test
    void issueAndConsumeRoundTripPreservesIssueTimeEditVersion() throws Exception {
        final var redis = mock(StringRedisTemplate.class);
        final var mapper = new ObjectMapper().findAndRegisterModules();
        final var store = new RedisWsTicketStore(redis, mapper);
        final var data = new TicketData("u1", "login-1", "User 1", 100L, Instant.now().plusSeconds(30), 3);
        doReturn(1L)
            .when(redis)
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
        assertThat(store.issueTicketAtomically("ticket", data, Duration.ofSeconds(30), 10)).isTrue();
        final var json = ArgumentCaptor.forClass(String.class);
        verify(redis).execute(
            org.mockito.ArgumentMatchers.<RedisScript<Long>>any(),
            anyList(),
            eq("ticket"),
            json.capture(),
            any(),
            any(),
            any(),
            any()
        );
        assertThat(mapper.readTree(json.getValue()).get("editProtocolVersion").asInt()).isEqualTo(3);
        doReturn(json.getValue())
            .when(redis)
            .execute(org.mockito.ArgumentMatchers.<RedisScript<String>>any(), anyList(), any(), any(), any());
        assertThat(store.consume("ticket")).contains(data);
    }

    @Test
    void legacyRedisJsonWithoutVersionIsConsumedAsLegacyV1AndRejectedByNewMinimum() throws Exception {
        final var redis = mock(StringRedisTemplate.class);
        final var mapper = new ObjectMapper().findAndRegisterModules();
        final var json = mapper.valueToTree(
            new TicketData("u1", "login-1", "User 1", 100L, Instant.now().plusSeconds(30), 3)
        );
        ((ObjectNode) json).remove("editProtocolVersion");
        doReturn(mapper.writeValueAsString(json))
            .when(redis)
            .execute(org.mockito.ArgumentMatchers.<RedisScript<String>>any(), anyList(), any(), any(), any());
        final var store = new RedisWsTicketStore(redis, mapper);
        final var properties = new CollaborationProperties();
        properties.setMinEditProtocolVersion(3);
        final var policy = new CollaborationProtocolPolicy(properties);
        final var service = new WsTicketService(
            new WebSocketProperties(),
            mock(UserRepository.class),
            mock(DiagramRepository.class),
            mock(TeamMemberRepository.class),
            store,
            policy
        );
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.validateAndConsume("legacy")).isInstanceOf(
            ProtocolTooOldException.class
        );
    }
}
