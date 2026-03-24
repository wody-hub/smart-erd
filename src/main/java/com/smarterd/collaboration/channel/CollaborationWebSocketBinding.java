package com.smarterd.collaboration.channel;

import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * 채널별 WebSocket handler / handshake interceptor 배선을 제공하는 support 포트.
 */
public interface CollaborationWebSocketBinding {

    /**
     * 채널 WebSocket 핸들러 등록 패턴을 반환한다.
     *
     * @return handler pattern
     */
    String websocketHandlerPattern();

    /**
     * 채널 WebSocket 핸들러를 반환한다.
     *
     * @return WebSocket handler
     */
    WebSocketHandler webSocketHandler();

    /**
     * 채널 핸드셰이크 인터셉터를 반환한다.
     *
     * @return handshake interceptor
     */
    HandshakeInterceptor handshakeInterceptor();
}
