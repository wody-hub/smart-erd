package com.smarterd.collaboration.channel;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

class CollaborationWebSocketRegistrationValidatorTest {

    @Test
    void shouldAcceptMatchingBindingAndSupportPatterns() {
        final var binding = new TestBinding("/ws/diagram/*");
        final var support = new TestEndpointSupport("/ws/diagram/*", "/ws/diagram/**");

        assertThatCode(() ->
            new CollaborationWebSocketRegistrationValidator(List.of(binding), List.of(support))
        ).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectMissingEndpointSupportForBinding() {
        final var binding = new TestBinding("/ws/diagram/*");
        final var support = new TestEndpointSupport("/ws/other/*", "/ws/other/**");

        assertThatThrownBy(() -> new CollaborationWebSocketRegistrationValidator(List.of(binding), List.of(support)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("등록 패턴이 일치하지 않음");
    }

    @Test
    void shouldRejectDuplicateBindingPattern() {
        final var bindingA = new TestBinding("/ws/diagram/*");
        final var bindingB = new TestBinding("/ws/diagram/*");
        final var support = new TestEndpointSupport("/ws/diagram/*", "/ws/diagram/**");

        assertThatThrownBy(() ->
            new CollaborationWebSocketRegistrationValidator(List.of(bindingA, bindingB), List.of(support))
        )
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("중복된 협업 WebSocket binding 패턴");
    }

    @Test
    void shouldRejectDuplicateEndpointSupportPattern() {
        final var binding = new TestBinding("/ws/diagram/*");
        final var supportA = new TestEndpointSupport("/ws/diagram/*", "/ws/diagram/**");
        final var supportB = new TestEndpointSupport("/ws/diagram/*", "/ws/diagram/**");

        assertThatThrownBy(() ->
            new CollaborationWebSocketRegistrationValidator(List.of(binding), List.of(supportA, supportB))
        )
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("중복된 협업 WebSocket endpoint support 패턴");
    }

    private record TestBinding(String websocketHandlerPattern) implements CollaborationWebSocketBinding {
        @Override
        public WebSocketHandler webSocketHandler() {
            return null;
        }

        @Override
        public HandshakeInterceptor handshakeInterceptor() {
            return null;
        }
    }

    private record TestEndpointSupport(
        String websocketHandlerPattern,
        String websocketSecurityPattern
    ) implements CollaborationEndpointSupport {}
}
