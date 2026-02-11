package com.smarterd.domain.diagram.websocket;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * ConcurrentHashMap 기반 in-memory ticket 저장소.
 *
 * <p>단일 서버 환경에서 사용되며, 주기적으로 만료된 ticket을 정리한다.</p>
 */
public class InMemoryWsTicketStore implements WsTicketStore {

    private static final Logger log = LoggerFactory.getLogger(InMemoryWsTicketStore.class);

    /** ticket → 발급 데이터 저장소 */
    private final Map<String, TicketData> tickets = new ConcurrentHashMap<>();

    @Override
    public void store(String ticket, TicketData data, Duration ttl) {
        tickets.put(ticket, data);
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
        final var now = Instant.now();
        final var removed = tickets.entrySet().removeIf((e) -> e.getValue().expiresAt().isBefore(now));
        if (removed && log.isDebugEnabled()) {
            log.debug("만료된 WebSocket ticket 정리 완료");
        }
    }
}
