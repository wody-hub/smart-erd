package com.smarterd.domain.diagram.websocket.relay;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.nio.ByteBuffer;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * WebSocket 메시지 직렬화 및 전송 공통 유틸.
 *
 * <p>핸들러들이 중복 없이 동일한 전송 규약(타입 바이트 prefix, 세션별 전송 락)을 사용하도록 보장한다.</p>
 */
@Component
@RequiredArgsConstructor
public class DiagramMessageSender {

    private final DiagramRoomManager roomManager;
    private final ObjectMapper objectMapper;

    /**
     * 메시지 타입 바이트를 선두에 붙여 payload를 구성한다.
     *
     * @param messageType 메시지 타입
     * @param body        본문 바이트
     * @return 타입 + 본문 payload
     */
    public byte[] wrapMessage(byte messageType, byte[] body) {
        final var payload = new byte[body.length + 1];
        payload[0] = messageType;
        System.arraycopy(body, 0, payload, 1, body.length);
        return payload;
    }

    /**
     * 같은 room의 다른 세션들로 메시지를 브로드캐스트한다.
     *
     * @param diagramId 대상 다이어그램 ID
     * @param sender    발신 세션(자기 자신 제외)
     * @param message   브로드캐스트할 메시지
     */
    public void broadcastToRoom(Long diagramId, WebSocketSession sender, BinaryMessage message) {
        roomManager.broadcast(
            Objects.requireNonNull(diagramId),
            Objects.requireNonNull(sender),
            Objects.requireNonNull(message)
        );
    }

    /**
     * JSON을 타입 payload로 감싸 room에 브로드캐스트한다.
     *
     * @param diagramId   대상 다이어그램 ID
     * @param sender      발신 세션(자기 자신 제외)
     * @param messageType 메시지 타입 바이트
     * @param payloadMap  JSON 직렬화할 payload 객체
     * @throws Exception JSON 직렬화 또는 전송 중 오류가 발생한 경우
     */
    public void broadcastJsonToRoom(
        Long diagramId,
        WebSocketSession sender,
        byte messageType,
        Map<String, ?> payloadMap
    ) throws Exception {
        final var payloadBytes = objectMapper.writeValueAsBytes(payloadMap);
        final var payload = wrapMessage(messageType, payloadBytes);
        broadcastToRoom(diagramId, sender, new BinaryMessage(Objects.requireNonNull(payload)));
    }

    /**
     * JSON을 타입 payload로 감싸 특정 세션에 전송한다.
     *
     * @param session     대상 세션
     * @param messageType 메시지 타입 바이트
     * @param payloadMap  JSON 직렬화할 payload 객체
     * @throws Exception JSON 직렬화 또는 전송 중 오류가 발생한 경우
     */
    public void sendJsonToSession(WebSocketSession session, byte messageType, Map<String, ?> payloadMap)
        throws Exception {
        final var payloadBytes = objectMapper.writeValueAsBytes(payloadMap);
        sendBinaryToSession(session, wrapMessage(messageType, payloadBytes));
    }

    /**
     * 특정 세션에 바이너리 payload를 전송한다.
     *
     * @param session 대상 세션
     * @param payload 전송할 payload
     * @throws Exception 전송 중 오류가 발생한 경우
     */
    public void sendBinaryToSession(WebSocketSession session, byte[] payload) throws Exception {
        final var lock = roomManager.getSessionLock(session);
        synchronized (lock) {
            session.sendMessage(new BinaryMessage(Objects.requireNonNull(payload)));
        }
    }

    /**
     * 동일 타입의 여러 메시지 body를 하나의 세션 락 범위 안에서 순차 전송한다.
     *
     * @param session 대상 세션
     * @param messageType 메시지 타입 바이트
     * @param bodies 전송할 본문 목록
     * @return 전송한 body 총 바이트 수
     * @throws Exception 전송 중 오류가 발생한 경우
     */
    public int sendWrappedMessagesToSession(
        WebSocketSession session,
        byte messageType,
        Collection<byte[]> bodies
    ) throws Exception {
        final var lock = roomManager.getSessionLock(session);
        var sentBytes = 0;
        synchronized (lock) {
            for (final var body : bodies) {
                final var nonNullBody = Objects.requireNonNull(body, "body must not be null");
                sentBytes += nonNullBody.length;
                session.sendMessage(new BinaryMessage(wrapMessage(messageType, nonNullBody)));
            }
        }
        return sentBytes;
    }

    /**
     * BinaryMessage payload를 안전하게 byte[]로 추출한다.
     *
     * <p>{@link java.nio.ByteBuffer#array()} 직접 사용을 피해서 direct/read-only buffer도 안전하게 처리한다.</p>
     *
     * @param message 원본 바이너리 메시지
     * @return 복사된 payload 바이트 배열
     */
    public byte[] extractPayload(BinaryMessage message) {
        final ByteBuffer buffer = message.getPayload().asReadOnlyBuffer();
        final var payload = new byte[buffer.remaining()];
        buffer.get(payload);
        return payload;
    }
}
