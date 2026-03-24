package com.smarterd.application.diagram.port;

import java.util.Objects;

/**
 * 다이어그램 협업 세션 식별자 값 객체.
 *
 * @param sessionId WebSocket 세션 ID
 */
public record DiagramSessionRef(String sessionId) {

    public DiagramSessionRef {
        Objects.requireNonNull(sessionId, "sessionId must not be null");
    }
}
