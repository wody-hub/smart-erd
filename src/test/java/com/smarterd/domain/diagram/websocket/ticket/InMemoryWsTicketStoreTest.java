package com.smarterd.domain.diagram.websocket.ticket;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InMemoryWsTicketStoreTest {

    private static final Duration TTL = Duration.ofSeconds(30);

    @Test
    @DisplayName("issueTicketAtomically - 동일 diagram ticket 교체는 상한 계산에서 누적되지 않는다")
    void issueTicketAtomically_replaceSameDiagram_doesNotAccumulateCount() {
        final var store = new InMemoryWsTicketStore();
        final var now = Instant.now();

        final var firstIssued = store.issueTicketAtomically(
            "ticket-1",
            new TicketData("u1", "login-1", "User 1", 100L, now.plusSeconds(30)),
            TTL,
            1
        );
        final var replacedIssued = store.issueTicketAtomically(
            "ticket-2",
            new TicketData("u1", "login-1", "User 1", 100L, now.plusSeconds(30)),
            TTL,
            1
        );

        assertThat(firstIssued).isTrue();
        assertThat(replacedIssued).isTrue();
        assertThat(store.countByLoginId("login-1")).isEqualTo(1);
        assertThat(store.consume("ticket-1")).isEmpty();
        assertThat(store.consume("ticket-2")).isPresent();
    }

    @Test
    @DisplayName("issueTicketAtomically - 상한 초과 시 발급을 거부한다")
    void issueTicketAtomically_overLimit_returnsFalse() {
        final var store = new InMemoryWsTicketStore();
        final var now = Instant.now();

        assertThat(
            store.issueTicketAtomically(
                "ticket-1",
                new TicketData("u1", "login-1", "User 1", 100L, now.plusSeconds(30)),
                TTL,
                1
            )
        ).isTrue();
        assertThat(
            store.issueTicketAtomically(
                "ticket-2",
                new TicketData("u1", "login-1", "User 1", 101L, now.plusSeconds(30)),
                TTL,
                1
            )
        ).isFalse();
    }
}
