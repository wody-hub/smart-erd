package com.smarterd.config.websocket;

import com.smarterd.config.security.CorsConfig;
import com.smarterd.collaboration.channel.CollaborationWebSocketBinding;
import java.util.List;
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
 * <p>채널별 Raw WebSocket 엔드포인트를 등록한다.
 * Yjs 바이너리 프로토콜을 사용하므로 STOMP 대신 Raw WebSocket을 사용한다.</p>
 */
@Configuration
@EnableWebSocket
@EnableConfigurationProperties(WebSocketProperties.class)
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    /** 등록된 채널 WebSocket 바인딩 */
    private final List<CollaborationWebSocketBinding> webSocketBindings;

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
        final var nonNullAllowedOrigins = Objects.requireNonNull(
            corsProperties.getAllowedOrigins().toArray(String[]::new)
        );
        for (final var binding : webSocketBindings) {
            nonNullRegistry
                .addHandler(
                    Objects.requireNonNull(binding.webSocketHandler(), "webSocketHandler must not be null"),
                    Objects.requireNonNull(binding.websocketHandlerPattern(), "websocketHandlerPattern must not be null")
                )
                .addInterceptors(
                    Objects.requireNonNull(binding.handshakeInterceptor(), "handshakeInterceptor must not be null")
                )
                .setAllowedOrigins(nonNullAllowedOrigins);
        }
    }
}
