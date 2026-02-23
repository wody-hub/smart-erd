package com.smarterd.domain.diagram.websocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.smarterd.TestcontainersConfiguration;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.ticket.TicketData;
import com.smarterd.domain.diagram.websocket.ticket.WsTicketStore;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

/**
 * 실제 WebSocket 엔드포인트 + ticket 핸드셰이크를 포함한 E2E 테스트.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class DiagramWebSocketE2ETest {

    @LocalServerPort
    private int port;

    @Autowired
    private WsTicketStore wsTicketStore;

    private final StandardWebSocketClient webSocketClient = new StandardWebSocketClient();

    private final BlockingQueue<WebSocketSession> openedSessions = new LinkedBlockingQueue<>();

    @AfterEach
    void tearDown() {
        while (!openedSessions.isEmpty()) {
            final var session = openedSessions.poll();
            if (session == null) {
                continue;
            }
            try {
                if (session.isOpen()) {
                    session.close(Objects.requireNonNull(CloseStatus.NORMAL));
                }
            } catch (Exception ignored) {
                // 테스트 정리 중 예외는 무시
            }
        }
    }

    @Test
    @DisplayName("E2E - 두 클라이언트 연결 후 YJS_UPDATE가 상대 세션으로 relay된다")
    void relayBetweenTwoClients() throws Exception {
        // given
        final var diagramId = 100L;
        final var ticket1 = issueTicket("u1", "login1", "User 1", diagramId);
        final var ticket2 = issueTicket("u2", "login2", "User 2", diagramId);

        final var c1 = new CollectingBinaryHandler();
        final var c2 = new CollectingBinaryHandler();

        final var s1 = connect(diagramId, ticket1, c1);
        final var s2 = connect(diagramId, ticket2, c2);
        openedSessions.offer(s1);
        openedSessions.offer(s2);

        c1.clear();
        c2.clear();

        final var update = new byte[] { DiagramMessageTypes.MSG_YJS_UPDATE, 0x21, 0x22, 0x23 };

        // when
        s1.sendMessage(new BinaryMessage(update));

        // then
        final var relayed = c2.awaitMessageOfType(DiagramMessageTypes.MSG_YJS_UPDATE, Duration.ofSeconds(3));
        assertThat(relayed).isNotNull();
        assertThat(relayed).isEqualTo(update);
    }

    @Test
    @DisplayName("E2E - 한번 사용된 ticket은 재사용할 수 없다")
    void consumedTicketCannotBeReused() throws Exception {
        // given
        final var diagramId = 200L;
        final var ticket = issueTicket("u1", "login1", "User 1", diagramId);
        final var c1 = new CollectingBinaryHandler();
        final var s1 = connect(diagramId, ticket, c1);
        openedSessions.offer(s1);

        // when & then
        assertThatThrownBy(() -> connect(diagramId, ticket, new CollectingBinaryHandler())).isInstanceOfAny(
            ExecutionException.class,
            RuntimeException.class
        );
    }

    @Test
    @DisplayName("E2E - ticket의 diagramId와 접속 경로 diagramId가 다르면 핸드셰이크가 거부된다")
    void diagramIdMismatchHandshakeRejected() {
        // given
        final var ticketDiagramId = 300L;
        final var connectDiagramId = 301L;
        final var ticket = issueTicket("u1", "login1", "User 1", ticketDiagramId);

        // when & then
        assertThatThrownBy(() -> connect(connectDiagramId, ticket, new CollectingBinaryHandler())).isInstanceOfAny(
            ExecutionException.class,
            RuntimeException.class
        );
    }

    private String issueTicket(String userId, String loginId, String userName, Long diagramId) {
        final var ticket = UUID.randomUUID().toString();
        final var ttl = Duration.ofMinutes(2);
        final var data = new TicketData(userId, loginId, userName, diagramId, Instant.now().plus(ttl));
        wsTicketStore.issueTicketAtomically(ticket, data, ttl, 10);
        return ticket;
    }

    private WebSocketSession connect(Long diagramId, String ticket, @NonNull WebSocketHandler handler)
        throws Exception {
        final var headers = new WebSocketHttpHeaders();
        headers.setOrigin("http://localhost:3000");
        final var uri = Objects.requireNonNull(
            URI.create("ws://localhost:" + port + "/ws/diagram/" + diagramId + "?ticket=" + ticket)
        );
        return webSocketClient.execute(handler, headers, uri).get(5, TimeUnit.SECONDS);
    }

    private static final class CollectingBinaryHandler extends BinaryWebSocketHandler {

        private final BlockingQueue<byte[]> inbox = new LinkedBlockingQueue<>();

        @Override
        protected void handleBinaryMessage(@NonNull WebSocketSession session, @NonNull BinaryMessage message) {
            inbox.offer(extract(message));
        }

        byte[] awaitMessageOfType(byte messageType, Duration timeout) throws InterruptedException {
            final var deadlineNanos = System.nanoTime() + timeout.toNanos();
            while (System.nanoTime() < deadlineNanos) {
                final var remaining = deadlineNanos - System.nanoTime();
                final var next = inbox.poll(Math.max(1, remaining), TimeUnit.NANOSECONDS);
                if (next == null) {
                    continue;
                }
                if (next.length > 0 && next[0] == messageType) {
                    return next;
                }
            }
            return null;
        }

        void clear() {
            inbox.clear();
        }

        private byte[] extract(BinaryMessage message) {
            final var buffer = message.getPayload().asReadOnlyBuffer();
            final var out = new byte[buffer.remaining()];
            buffer.get(out);
            return out;
        }
    }
}
