package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationEndpointSupport;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널의 WebSocket endpoint 패턴 정의.
 */
@Component
public class DiagramCollaborationEndpointSupport implements CollaborationEndpointSupport {

    private static final String WEBSOCKET_HANDLER_PATTERN = "/ws/diagram/*";
    private static final String WEBSOCKET_SECURITY_PATTERN = "/ws/diagram/**";

    @Override
    public String websocketHandlerPattern() {
        return WEBSOCKET_HANDLER_PATTERN;
    }

    @Override
    public String websocketSecurityPattern() {
        return WEBSOCKET_SECURITY_PATTERN;
    }
}
