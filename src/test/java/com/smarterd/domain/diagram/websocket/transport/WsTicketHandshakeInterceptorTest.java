package com.smarterd.domain.diagram.websocket.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.application.diagram.command.DiagramHandshakeValidationResult;
import com.smarterd.application.diagram.command.ValidateDiagramCollaborationHandshakeUseCase;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

@ExtendWith(MockitoExtension.class)
class WsTicketHandshakeInterceptorTest {

    @Mock
    private ValidateDiagramCollaborationHandshakeUseCase validateDiagramCollaborationHandshakeUseCase;

    @Mock
    private ServerHttpRequest request;

    @Mock
    private ServerHttpResponse response;

    @Mock
    private WebSocketHandler webSocketHandler;

    @Test
    void beforeHandshake_storesCommonSessionAttributesOnSuccess() {
        final var interceptor = new WsTicketHandshakeInterceptor(validateDiagramCollaborationHandshakeUseCase);
        final var attributes = new HashMap<String, Object>();
        final var resourceKey = new com.smarterd.collaboration.channel.CollaborationResourceKey("diagram", "42");
        final var session = new CollaborationAuthenticatedSession(
            "user-1",
            "tester",
            "Tester",
            resourceKey,
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        when(request.getURI()).thenReturn(URI.create("/ws/diagram/42?ticket=ticket-1&protocolVersion=2"));
        when(validateDiagramCollaborationHandshakeUseCase.validate("/ws/diagram/42", "ticket-1", 2)).thenReturn(
            Optional.of(new DiagramHandshakeValidationResult(session, 42L))
        );

        final var accepted = interceptor.beforeHandshake(request, response, webSocketHandler, attributes);

        assertThat(accepted).isTrue();
        assertThat(
            attributes.get(com.smarterd.collaboration.session.CollaborationAuthenticatedSession.SESSION_ATTR_KEY)
        ).isEqualTo(session);
        assertThat(attributes).hasSize(1);
    }

    @Test
    void beforeHandshake_rejectsWhenTicketValidationFails() {
        final var interceptor = new WsTicketHandshakeInterceptor(validateDiagramCollaborationHandshakeUseCase);
        final var attributes = new HashMap<String, Object>();

        when(request.getURI()).thenReturn(URI.create("/ws/diagram/42?ticket=ticket-1"));
        when(validateDiagramCollaborationHandshakeUseCase.validate("/ws/diagram/42", "ticket-1", 1)).thenReturn(
            Optional.empty()
        );

        final var accepted = interceptor.beforeHandshake(request, response, webSocketHandler, attributes);

        assertThat(accepted).isFalse();
        assertThat(attributes).isEmpty();
        verify(validateDiagramCollaborationHandshakeUseCase).validate("/ws/diagram/42", "ticket-1", 1);
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }
}
