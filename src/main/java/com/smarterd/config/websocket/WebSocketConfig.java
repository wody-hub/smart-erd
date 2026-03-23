package com.smarterd.config.websocket;

import com.smarterd.config.security.CorsConfig;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.websocket.transport.DiagramWebSocketHandler;
import com.smarterd.domain.diagram.websocket.transport.WsTicketHandshakeInterceptor;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket 설정.
 *
 * <p>Raw WebSocket 엔드포인트 {@code /ws/diagram/{diagramId}}를 등록한다.
 * Yjs 바이너리 프로토콜을 사용하므로 STOMP 대신 Raw WebSocket을 사용한다.
 * 인증은 {@link WsTicketHandshakeInterceptor}에서 일회용 ticket으로 처리한다.</p>
 */
@Configuration
@EnableWebSocket
@EnableConfigurationProperties(WebSocketProperties.class)
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    /** 다이어그램 WebSocket 핸들러 */
    private final DiagramWebSocketHandler diagramWebSocketHandler;

    /** ticket 핸드셰이크 인터셉터 */
    private final WsTicketHandshakeInterceptor wsTicketHandshakeInterceptor;

    /** CORS 프로퍼티 */
    private final CorsConfig.CorsProperties corsProperties;

    /**
     * WebSocket 핸들러를 등록한다.
     *
     * @param registry WebSocket 핸들러 레지스트리
     */
    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        final var nonNullRegistry = Objects.requireNonNull(registry, "registry must not be null");
        final var nonNullDiagramWebSocketHandler = Objects.requireNonNull(
            diagramWebSocketHandler,
            "diagramWebSocketHandler must not be null"
        );
        final var nonNullAllowedOrigins = Objects.requireNonNull(
            corsProperties.getAllowedOrigins().toArray(String[]::new)
        );

        nonNullRegistry
            .addHandler(nonNullDiagramWebSocketHandler, DiagramCollaborationResourceKeyFactory.WEBSOCKET_HANDLER_PATTERN)
            .addInterceptors(wsTicketHandshakeInterceptor)
            .setAllowedOrigins(nonNullAllowedOrigins);
    }
}
