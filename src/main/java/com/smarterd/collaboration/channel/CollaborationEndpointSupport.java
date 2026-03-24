package com.smarterd.collaboration.channel;

/**
 * 채널별 WebSocket 엔드포인트 패턴을 제공하는 support 포트.
 */
public interface CollaborationEndpointSupport {

    /**
     * WebSocket 핸들러 등록 패턴을 반환한다.
     *
     * @return handler pattern
     */
    String websocketHandlerPattern();

    /**
     * Spring Security 허용 패턴을 반환한다.
     *
     * @return security pattern
     */
    String websocketSecurityPattern();
}
