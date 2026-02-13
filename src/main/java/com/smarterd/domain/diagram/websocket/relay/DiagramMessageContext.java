package com.smarterd.domain.diagram.websocket.relay;

import com.smarterd.domain.diagram.websocket.session.AuthenticatedSession;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * 메시지 타입별 핸들러에 전달되는 공통 컨텍스트.
 *
 * <p>핸들러는 이 컨텍스트만으로 인증 사용자, room 식별자, 원본 메시지 바이트에 접근할 수 있다.</p>
 *
 * @param session     WebSocket 세션
 * @param sessionInfo 세션 메타데이터
 * @param diagramId   다이어그램 ID
 * @param message     원본 바이너리 메시지
 * @param payload     원본 payload 바이트
 */
public record DiagramMessageContext(
    WebSocketSession session,
    AuthenticatedSession sessionInfo,
    Long diagramId,
    BinaryMessage message,
    byte[] payload
) {
    /**
     * payload의 첫 바이트(메시지 타입)를 반환한다.
     *
     * @return 메시지 타입. payload가 비어 있으면 {@code 0}
     */
    public byte messageType() {
        if (payload.length == 0) {
            return 0;
        }
        return payload[0];
    }
}
