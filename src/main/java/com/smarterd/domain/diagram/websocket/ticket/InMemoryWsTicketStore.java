package com.smarterd.domain.diagram.websocket.ticket;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * ConcurrentHashMap 기반 in-memory ticket 저장소.
 *
 * <p>단일 서버 환경에서 사용되며, 주기적으로 만료된 ticket을 정리한다.</p>
 */
@Slf4j
public class InMemoryWsTicketStore implements WsTicketStore {

    /** ticket → 발급 데이터 저장소 */
    private final Map<String, TicketData> tickets = new ConcurrentHashMap<>();

    @Override
    public synchronized boolean issueTicketAtomically(
        String ticket,
        TicketData data,
        Duration ttl,
        int maxOutstanding
    ) {
        Objects.requireNonNull(ticket, "ticket must not be null");
        Objects.requireNonNull(data, "data must not be null");
        Objects.requireNonNull(ttl, "ttl must not be null");

        cleanupExpiredTickets(Instant.now());
        removeByLoginIdAndDiagramId(data.loginId(), data.diagramId());

        final var outstandingCount = tickets
            .values()
            .stream()
            .filter((d) -> d.loginId().equals(data.loginId()) && d.expiresAt().isAfter(Instant.now()))
            .count();
        if (outstandingCount >= maxOutstanding) {
            return false;
        }

        tickets.put(ticket, data);
        return true;
    }

    @Override
    public Optional<TicketData> consume(String ticket) {
        final var data = tickets.remove(ticket);
        if (data == null) {
            return Optional.empty();
        }
        if (data.expiresAt().isBefore(Instant.now())) {
            log.debug("WebSocket ticket 만료: loginId={}", data.loginId());
            return Optional.empty();
        }
        return Optional.of(data);
    }

    @Override
    public void removeByLoginIdAndDiagramId(String loginId, Long diagramId) {
        tickets
            .entrySet()
            .removeIf((e) -> e.getValue().loginId().equals(loginId) && e.getValue().diagramId().equals(diagramId));
    }

    @Override
    public long countByLoginId(String loginId) {
        cleanupExpiredTickets(Instant.now());
        return tickets
            .values()
            .stream()
            .filter((d) -> d.loginId().equals(loginId))
            .count();
    }

    /**
     * 만료된 ticket을 주기적으로 정리한다.
     */
    @Scheduled(fixedDelay = 60000)
    public void cleanupExpiredTickets() {
        final var removed = cleanupExpiredTickets(Instant.now());
        if (removed && log.isDebugEnabled()) {
            log.debug("만료된 WebSocket ticket 정리 완료");
        }
    }

    /**
     * 기준 시각 이전에 만료된 ticket을 제거한다.
     *
     * @param now 만료 판정 기준 시각
     * @return 하나 이상 제거되면 {@code true}
     */
    private boolean cleanupExpiredTickets(Instant now) {
        return tickets.entrySet().removeIf((e) -> e.getValue().expiresAt().isBefore(now));
    }
}
