package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class AiExecutionRegistryTest {

    @Test
    void terminalStateIsImmutable() {
        final var registry = new AiExecutionRegistry(Duration.ofMinutes(15), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        final var execution = registry.create("tester", 1L, 10L, "noop", "provider-response-v1");

        assertThat(registry.markSucceeded(execution.executionId(), null)).isTrue();
        assertThat(registry.markCancelled(execution.executionId())).isFalse();

        assertThat(registry.get(execution.executionId(), "tester").state()).isEqualTo(AiExecutionState.SUCCEEDED);
    }

    @Test
    void repeatedCancelOnTerminalExecutionReturnsCurrentStateWithoutInvokingCancelHandle() {
        final var cancelCount = new AtomicInteger();
        final var registry = new AiExecutionRegistry(Duration.ofMinutes(15), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        final var execution = registry.create("tester", 1L, 10L, "noop", "provider-response-v1");
        registry.registerCancelHandler(execution.executionId(), cancelCount::incrementAndGet);

        final var first = registry.cancel(execution.executionId(), "tester");
        final var second = registry.cancel(execution.executionId(), "tester");

        assertThat(first.state()).isEqualTo(AiExecutionState.CANCELLED);
        assertThat(second.state()).isEqualTo(AiExecutionState.CANCELLED);
        assertThat(cancelCount).hasValue(1);
    }

    @Test
    void lookupRejectsOtherUser() {
        final var registry = new AiExecutionRegistry(Duration.ofMinutes(15), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        final var execution = registry.create("tester", 1L, 10L, "noop", "provider-response-v1");

        assertThatThrownBy(() -> registry.get(execution.executionId(), "other"))
            .isInstanceOf(DomainAccessDeniedException.class);
    }

    @Test
    void lookupAfterRetentionExpiryReturnsNotFound() {
        final var clock = new MutableClock(Instant.EPOCH);
        final var registry = new AiExecutionRegistry(Duration.ofSeconds(5), clock);
        final var execution = registry.create("tester", 1L, 10L, "noop", "provider-response-v1");
        registry.markSucceeded(execution.executionId(), null);

        clock.advance(Duration.ofSeconds(6));

        assertThatThrownBy(() -> registry.get(execution.executionId(), "tester")).isInstanceOf(EntityNotFoundException.class);
    }

    private static final class MutableClock extends Clock {

        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
