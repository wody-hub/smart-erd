package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationWebSocketBinding;
import com.smarterd.domain.diagram.websocket.transport.DiagramWebSocketHandler;
import com.smarterd.domain.diagram.websocket.transport.WsTicketHandshakeInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * 다이어그램 채널의 WebSocket handler / handshake 배선 정의.
 */
@Component
@RequiredArgsConstructor
public class DiagramCollaborationWebSocketBinding implements CollaborationWebSocketBinding {

    private final DiagramCollaborationEndpointSupport endpointSupport;
    private final DiagramWebSocketHandler diagramWebSocketHandler;
    private final WsTicketHandshakeInterceptor wsTicketHandshakeInterceptor;

    @Override
    public String websocketHandlerPattern() {
        return endpointSupport.websocketHandlerPattern();
    }

    @Override
    public WebSocketHandler webSocketHandler() {
        return diagramWebSocketHandler;
    }

    @Override
    public HandshakeInterceptor handshakeInterceptor() {
        return wsTicketHandshakeInterceptor;
    }
}
