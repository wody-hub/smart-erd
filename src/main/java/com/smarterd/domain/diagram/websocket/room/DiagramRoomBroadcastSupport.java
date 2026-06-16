package com.smarterd.domain.diagram.websocket.room;

import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.BinaryMessage;

/**
 * room 브로드캐스트 전송을 담당한다.
 */
@Slf4j
final class DiagramRoomBroadcastSupport {

    private final DiagramSessionRegistry sessionRegistry;

    /**
     * @param sessionRegistry 세션 저장소
     */
    DiagramRoomBroadcastSupport(DiagramSessionRegistry sessionRegistry) {
        this.sessionRegistry = sessionRegistry;
    }

    /**
     * 같은 다이어그램 room의 다른 세션에게 바이너리 메시지를 전송한다.
     *
     * @param diagramId 다이어그램 ID
     * @param senderSessionId 발신 세션 ID
     * @param message 바이너리 메시지
     */
    void broadcast(Long diagramId, String senderSessionId, BinaryMessage message) {
        final var nonNullDiagramId = Objects.requireNonNull(diagramId, "diagramId must not be null");
        final var nonNullSenderSessionId = Objects.requireNonNull(senderSessionId, "senderSessionId must not be null");
        final var nonNullMessage = Objects.requireNonNull(message, "message must not be null");
        final var payload = copyPayload(nonNullMessage);
        final var isLast = nonNullMessage.isLast();

        final var sessions = sessionRegistry.getSessionsOrEmpty(nonNullDiagramId);
        for (final var session : sessions) {
            if (nonNullSenderSessionId.equals(session.getId()) || !session.isOpen()) {
                continue;
            }
            try {
                final var lock = sessionRegistry.getSessionLock(session);
                synchronized (lock) {
                    session.sendMessage(new BinaryMessage(Arrays.copyOf(payload, payload.length), isLast));
                }
            } catch (Exception e) {
                log.warn("메시지 전송 실패 (세션 {})", session.getId(), e);
            }
        }
    }

    /**
     * BinaryMessage payload를 세션별 재전송에 안전한 byte 배열로 복사한다.
     *
     * @param message 원본 바이너리 메시지
     * @return 복사된 payload
     */
    private byte[] copyPayload(BinaryMessage message) {
        final ByteBuffer buffer = message.getPayload().asReadOnlyBuffer();
        final var payload = new byte[buffer.remaining()];
        buffer.get(payload);
        return payload;
    }
}
